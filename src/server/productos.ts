import { and, asc, desc, eq, gte, like, or, sql } from 'drizzle-orm'
import { db } from '@/db/client'
import { categorias, movimientosStock, productos } from '@/db/schema'
import { ApiError } from '@/lib/errors'
import type { EditarProductoForm, MovimientoForm, ProductoForm } from '@/lib/validation'
import type { Sesion } from './auth'

/**
 * Reglas de productos y stock. La interfaz no decide nada: llama aca.
 * La existencia solo cambia por un movimiento, nunca por un update directo.
 */

export type FilaProducto = {
  id: number
  codigo: string
  descripcion: string
  precio: number
  existencia: number
  stockMinimo: number
  activo: boolean
  categoriaId: number | null
  categoria: string | null
}

export async function listarCategorias() {
  return db
    .select({ id: categorias.id, nombre: categorias.nombre })
    .from(categorias)
    .where(eq(categorias.activa, true))
    .orderBy(asc(categorias.nombre))
}

export async function listarProductos(filtro: { q?: string } = {}): Promise<FilaProducto[]> {
  const q = filtro.q?.trim()
  const patron = q ? `%${q}%` : null

  const filas = await db
    .select({
      id: productos.id,
      codigo: productos.codigo,
      descripcion: productos.descripcion,
      precio: productos.precio,
      existencia: productos.existencia,
      stockMinimo: productos.stockMinimo,
      activo: productos.activo,
      categoriaId: productos.categoriaId,
      categoria: categorias.nombre,
    })
    .from(productos)
    .leftJoin(categorias, eq(productos.categoriaId, categorias.id))
    .where(patron ? or(like(productos.codigo, patron), like(productos.descripcion, patron)) : undefined)
    .orderBy(asc(productos.descripcion))

  return filas
}

export async function obtenerProducto(id: number): Promise<FilaProducto> {
  const [fila] = await db
    .select({
      id: productos.id,
      codigo: productos.codigo,
      descripcion: productos.descripcion,
      precio: productos.precio,
      existencia: productos.existencia,
      stockMinimo: productos.stockMinimo,
      activo: productos.activo,
      categoriaId: productos.categoriaId,
      categoria: categorias.nombre,
    })
    .from(productos)
    .leftJoin(categorias, eq(productos.categoriaId, categorias.id))
    .where(eq(productos.id, id))
    .limit(1)

  if (!fila) throw new ApiError(404, 'PRODUCTO_NO_ENCONTRADO', 'El producto no existe.')
  return fila
}

async function codigoLibre(codigo: string, exceptoId?: number) {
  const [existente] = await db
    .select({ id: productos.id })
    .from(productos)
    .where(eq(productos.codigo, codigo))
    .limit(1)

  if (existente && existente.id !== exceptoId) {
    throw new ApiError(409, 'CODIGO_DUPLICADO', `Ya existe un producto con el código ${codigo}.`)
  }
}

export async function crearProducto(sesion: Sesion, datos: ProductoForm) {
  await codigoLibre(datos.codigo)

  return db.transaction(async (tx) => {
    const [creado] = await tx
      .insert(productos)
      .values({
        codigo: datos.codigo,
        descripcion: datos.descripcion,
        categoriaId: datos.categoriaId,
        precio: datos.precio,
        existencia: datos.stockInicial,
        stockMinimo: datos.stockMinimo,
        activo: true,
      })
      .returning()

    // El stock inicial se registra como una entrada, no como un número suelto.
    if (datos.stockInicial > 0) {
      await tx.insert(movimientosStock).values({
        productoId: creado.id,
        tipo: 'ingreso',
        cantidad: datos.stockInicial,
        existenciaResultante: datos.stockInicial,
        motivo: 'Stock inicial',
        usuarioId: sesion.id,
      })
    }

    return creado
  })
}

export async function editarProducto(id: number, datos: EditarProductoForm) {
  await obtenerProducto(id)
  await codigoLibre(datos.codigo, id)

  const [actualizado] = await db
    .update(productos)
    .set({
      codigo: datos.codigo,
      descripcion: datos.descripcion,
      categoriaId: datos.categoriaId,
      precio: datos.precio,
      stockMinimo: datos.stockMinimo,
      activo: datos.activo,
    })
    .where(eq(productos.id, id))
    .returning()

  if (!actualizado) {
    throw new ApiError(404, 'PRODUCTO_NO_ENCONTRADO', 'El producto no existe.')
  }

  // La existencia no se toca por edición. Solo cambia por un movimiento.
  return actualizado
}

export async function moverStock(sesion: Sesion, productoId: number, datos: MovimientoForm) {
  return db.transaction(async (tx) => {
    const [producto] = await tx
      .select({ existencia: productos.existencia })
      .from(productos)
      .where(eq(productos.id, productoId))
      .limit(1)

    if (!producto) {
      throw new ApiError(404, 'PRODUCTO_NO_ENCONTRADO', 'El producto no existe.')
    }

    const delta = datos.tipo === 'ingreso' ? datos.cantidad : -datos.cantidad

    // La condición vive en el UPDATE: si no alcanza, no actualiza ni una fila.
    const [actualizado] = await tx
      .update(productos)
      .set({ existencia: sql`${productos.existencia} + ${delta}` })
      .where(
        delta < 0
          ? and(eq(productos.id, productoId), gte(productos.existencia, -delta))
          : eq(productos.id, productoId),
      )
      .returning({ existencia: productos.existencia })

    if (!actualizado) {
      throw new ApiError(
        422,
        'STOCK_INSUFICIENTE',
        `No hay stock suficiente. Quedan ${producto.existencia} unidades.`,
      )
    }

    const [movimiento] = await tx
      .insert(movimientosStock)
      .values({
        productoId,
        tipo: datos.tipo,
        cantidad: delta,
        existenciaResultante: actualizado.existencia,
        motivo: datos.motivo,
        observacion: datos.observacion,
        usuarioId: sesion.id,
      })
      .returning()

    return movimiento
  })
}

export async function listarMovimientos(productoId: number) {
  return db
    .select({
      id: movimientosStock.id,
      tipo: movimientosStock.tipo,
      cantidad: movimientosStock.cantidad,
      existenciaResultante: movimientosStock.existenciaResultante,
      motivo: movimientosStock.motivo,
      observacion: movimientosStock.observacion,
      fecha: movimientosStock.fecha,
      facturaId: movimientosStock.facturaId,
    })
    .from(movimientosStock)
    .where(eq(movimientosStock.productoId, productoId))
    .orderBy(desc(movimientosStock.fecha), desc(movimientosStock.id))
    .limit(50)
}
