import { and, asc, desc, eq, gte, like, lte, or, sql } from 'drizzle-orm'
import { db } from '@/db/client'
import { categorias, facturas, movimientosStock, productos, usuarios } from '@/db/schema'
import { ApiError } from '@/lib/errors'
import { formatearNumero } from '@/lib/dinero'
import type { Pagina, Paginacion } from '@/lib/paginacion'
import type { EditarProductoForm, MovimientoForm, ProductoForm } from '@/lib/validation'
import type { Sesion } from './auth'
import { exigirAdmin } from './permisos'

/**
 * Reglas de productos y stock. La existencia solo cambia por un movimiento,
 * nunca por un update directo (RF-P4 y RF-P5).
 */

export type ProductoPublico = {
  id: number
  codigo: string
  descripcion: string
  categoriaId: number | null
  categoria: { id: number; nombre: string } | null
  precio: number
  existencia: number
  stockMinimo: number
  bajoMinimo: boolean
  activo: boolean
}

export type MovimientoPublico = {
  id: number
  producto: { id: number; codigo: string; descripcion: string }
  tipo: string
  cantidad: number
  existenciaResultante: number
  motivo: string | null
  observacion: string | null
  referencia: { facturaId: number; numero: string } | null
  usuario: { id: number; nombre: string } | null
  fecha: Date
}

type FiltroProductos = {
  q?: string
  categoriaId?: number
  bajoMinimo?: boolean
  activo?: boolean | 'todos'
}

type FiltroMovimientos = {
  q?: string
  tipo?: string
  productoId?: number
  desde?: Date
  hasta?: Date
}

const seleccionProducto = {
  id: productos.id,
  codigo: productos.codigo,
  descripcion: productos.descripcion,
  precio: productos.precio,
  existencia: productos.existencia,
  stockMinimo: productos.stockMinimo,
  activo: productos.activo,
  categoriaId: productos.categoriaId,
  categoriaNombre: categorias.nombre,
}

type FilaProducto = {
  id: number
  codigo: string
  descripcion: string
  precio: number
  existencia: number
  stockMinimo: number
  activo: boolean
  categoriaId: number | null
  categoriaNombre: string | null
}

function aPublico(fila: FilaProducto): ProductoPublico {
  return {
    id: fila.id,
    codigo: fila.codigo,
    descripcion: fila.descripcion,
    categoriaId: fila.categoriaId,
    categoria:
      fila.categoriaId === null
        ? null
        : { id: fila.categoriaId, nombre: fila.categoriaNombre ?? 'Sin categoría' },
    precio: fila.precio,
    existencia: fila.existencia,
    stockMinimo: fila.stockMinimo,
    bajoMinimo: fila.existencia <= fila.stockMinimo,
    activo: fila.activo,
  }
}

function condicionesProductos(filtro: FiltroProductos) {
  const condiciones = []
  const q = filtro.q?.trim()

  if (q) {
    const patron = `%${q}%`
    condiciones.push(or(like(productos.codigo, patron), like(productos.descripcion, patron)))
  }
  if (filtro.categoriaId) condiciones.push(eq(productos.categoriaId, filtro.categoriaId))
  if (filtro.bajoMinimo) condiciones.push(lte(productos.existencia, productos.stockMinimo))
  if (filtro.activo !== 'todos') condiciones.push(eq(productos.activo, filtro.activo ?? true))

  return condiciones.length ? and(...condiciones) : undefined
}

export async function listarProductos(
  filtro: FiltroProductos & Partial<Paginacion> = {},
): Promise<Pagina<ProductoPublico>> {
  const page = filtro.page ?? 1
  const pageSize = filtro.pageSize ?? 100
  const where = condicionesProductos(filtro)

  const [conteo] = await db
    .select({ total: sql<number>`count(*)` })
    .from(productos)
    .where(where)

  const filas = await db
    .select(seleccionProducto)
    .from(productos)
    .leftJoin(categorias, eq(productos.categoriaId, categorias.id))
    .where(where)
    .orderBy(asc(productos.descripcion))
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  return { data: filas.map(aPublico), page, pageSize, total: Number(conteo.total) }
}

export async function obtenerProducto(id: number): Promise<ProductoPublico> {
  const [fila] = await db
    .select(seleccionProducto)
    .from(productos)
    .leftJoin(categorias, eq(productos.categoriaId, categorias.id))
    .where(eq(productos.id, id))
    .limit(1)

  if (!fila) throw new ApiError(404, 'NO_ENCONTRADO', 'El producto no existe.')
  return aPublico(fila)
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
  exigirAdmin(sesion)
  await codigoLibre(datos.codigo)

  const [creado] = await db.transaction(async (tx) => {
    const [nuevo] = await tx
      .insert(productos)
      .values({
        codigo: datos.codigo,
        descripcion: datos.descripcion,
        categoriaId: datos.categoriaId,
        precio: datos.precio,
        existencia: datos.stockInicial,
        stockMinimo: datos.stockMinimo,
        activo: datos.activo,
      })
      .returning()

    // El stock inicial se registra como una entrada, no como un número suelto.
    if (datos.stockInicial > 0) {
      await tx.insert(movimientosStock).values({
        productoId: nuevo.id,
        tipo: 'ingreso',
        cantidad: datos.stockInicial,
        existenciaResultante: datos.stockInicial,
        motivo: 'Stock inicial',
        usuarioId: sesion.id,
      })
    }

    return [nuevo]
  })

  return obtenerProducto(creado.id)
}

type CambiosProducto = Partial<{
  codigo: string
  descripcion: string
  categoriaId: number | null
  precio: number
  stockMinimo: number
  activo: boolean
}>

export async function editarProducto(
  sesion: Sesion,
  id: number,
  datos: EditarProductoForm | CambiosProducto,
) {
  exigirAdmin(sesion)
  const actual = await obtenerProducto(id)

  const siguiente = {
    codigo: datos.codigo ?? actual.codigo,
    descripcion: datos.descripcion ?? actual.descripcion,
    categoriaId:
      datos.categoriaId === undefined ? (actual.categoria?.id ?? null) : datos.categoriaId,
    precio: datos.precio ?? actual.precio,
    stockMinimo: datos.stockMinimo ?? actual.stockMinimo,
    activo: datos.activo ?? actual.activo,
  }

  await codigoLibre(siguiente.codigo, id)

  await db.update(productos).set(siguiente).where(eq(productos.id, id))

  // La existencia no se toca por edición. Solo cambia por un movimiento.
  return obtenerProducto(id)
}

export async function moverStock(sesion: Sesion, productoId: number, datos: MovimientoForm) {
  exigirAdmin(sesion)

  return db.transaction(async (tx) => {
    const [producto] = await tx
      .select({ existencia: productos.existencia })
      .from(productos)
      .where(eq(productos.id, productoId))
      .limit(1)

    if (!producto) {
      throw new ApiError(404, 'NO_ENCONTRADO', 'El producto no existe.')
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
        409,
        'STOCK_INSUFICIENTE',
        `No hay stock suficiente. Quedan ${producto.existencia} unidades.`,
        [{ productoId, solicitado: datos.cantidad, disponible: producto.existencia }],
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

async function filaMovimiento(id: number): Promise<MovimientoPublico> {
  const filas = await db
    .select({
      id: movimientosStock.id,
      tipo: movimientosStock.tipo,
      cantidad: movimientosStock.cantidad,
      existenciaResultante: movimientosStock.existenciaResultante,
      motivo: movimientosStock.motivo,
      observacion: movimientosStock.observacion,
      fecha: movimientosStock.fecha,
      productoId: productos.id,
      codigo: productos.codigo,
      descripcionProducto: productos.descripcion,
      facturaId: facturas.id,
      facturaNumero: facturas.numero,
      facturaPuntoVenta: facturas.puntoVenta,
      usuarioId: usuarios.id,
      usuarioNombre: usuarios.nombre,
    })
    .from(movimientosStock)
    .innerJoin(productos, eq(movimientosStock.productoId, productos.id))
    .leftJoin(facturas, eq(movimientosStock.facturaId, facturas.id))
    .leftJoin(usuarios, eq(movimientosStock.usuarioId, usuarios.id))
    .where(eq(movimientosStock.id, id))
    .limit(1)

  const fila = filas[0]
  if (!fila) throw new ApiError(404, 'NO_ENCONTRADO', 'El movimiento no existe.')

  return {
    id: fila.id,
    producto: { id: fila.productoId, codigo: fila.codigo, descripcion: fila.descripcionProducto },
    tipo: fila.tipo,
    cantidad: fila.cantidad,
    existenciaResultante: fila.existenciaResultante,
    motivo: fila.motivo,
    observacion: fila.observacion,
    referencia:
      fila.facturaId === null
        ? null
        : {
            facturaId: fila.facturaId,
            numero: formatearNumero(fila.facturaPuntoVenta ?? 1, fila.facturaNumero ?? 0),
          },
    usuario:
      fila.usuarioId === null
        ? null
        : { id: fila.usuarioId, nombre: fila.usuarioNombre ?? 'Usuario' },
    fecha: fila.fecha,
  }
}

export async function obtenerMovimiento(id: number) {
  return filaMovimiento(id)
}

function condicionesMovimientos(filtro: FiltroMovimientos) {
  const condiciones = []
  const q = filtro.q?.trim()

  if (q) {
    const patron = `%${q}%`
    condiciones.push(or(like(productos.codigo, patron), like(productos.descripcion, patron)))
  }
  if (filtro.tipo) condiciones.push(eq(movimientosStock.tipo, filtro.tipo))
  if (filtro.productoId) condiciones.push(eq(movimientosStock.productoId, filtro.productoId))
  if (filtro.desde) condiciones.push(gte(movimientosStock.fecha, filtro.desde))
  if (filtro.hasta) condiciones.push(lte(movimientosStock.fecha, filtro.hasta))

  return condiciones.length ? and(...condiciones) : undefined
}

async function consultarMovimientos(
  filtro: FiltroMovimientos,
  paginacion: Paginacion,
): Promise<Pagina<MovimientoPublico>> {
  const where = condicionesMovimientos(filtro)

  const [conteo] = await db
    .select({ total: sql<number>`count(*)` })
    .from(movimientosStock)
    .innerJoin(productos, eq(movimientosStock.productoId, productos.id))
    .where(where)

  const filas = await db
    .select({
      id: movimientosStock.id,
      tipo: movimientosStock.tipo,
      cantidad: movimientosStock.cantidad,
      existenciaResultante: movimientosStock.existenciaResultante,
      motivo: movimientosStock.motivo,
      observacion: movimientosStock.observacion,
      fecha: movimientosStock.fecha,
      productoId: productos.id,
      codigo: productos.codigo,
      descripcionProducto: productos.descripcion,
      facturaId: facturas.id,
      facturaNumero: facturas.numero,
      facturaPuntoVenta: facturas.puntoVenta,
      usuarioId: usuarios.id,
      usuarioNombre: usuarios.nombre,
    })
    .from(movimientosStock)
    .innerJoin(productos, eq(movimientosStock.productoId, productos.id))
    .leftJoin(facturas, eq(movimientosStock.facturaId, facturas.id))
    .leftJoin(usuarios, eq(movimientosStock.usuarioId, usuarios.id))
    .where(where)
    .orderBy(desc(movimientosStock.fecha), desc(movimientosStock.id))
    .limit(paginacion.pageSize)
    .offset((paginacion.page - 1) * paginacion.pageSize)

  return {
    data: filas.map((fila) => ({
      id: fila.id,
      producto: {
        id: fila.productoId,
        codigo: fila.codigo,
        descripcion: fila.descripcionProducto,
      },
      tipo: fila.tipo,
      cantidad: fila.cantidad,
      existenciaResultante: fila.existenciaResultante,
      motivo: fila.motivo,
      observacion: fila.observacion,
      referencia:
        fila.facturaId === null
          ? null
          : {
              facturaId: fila.facturaId,
              numero: formatearNumero(fila.facturaPuntoVenta ?? 1, fila.facturaNumero ?? 0),
            },
      usuario:
        fila.usuarioId === null
          ? null
          : { id: fila.usuarioId, nombre: fila.usuarioNombre ?? 'Usuario' },
      fecha: fila.fecha,
    })),
    page: paginacion.page,
    pageSize: paginacion.pageSize,
    total: Number(conteo.total),
  }
}

export async function listarMovimientos(
  productoId: number,
  paginacion: Paginacion = { page: 1, pageSize: 50 },
): Promise<Pagina<MovimientoPublico>> {
  await obtenerProducto(productoId)
  return consultarMovimientos({ productoId }, paginacion)
}

/** Todos los movimientos, con el producto y la venta asociada (RF-P6). */
export async function listarMovimientosGlobal(
  filtro: FiltroMovimientos = {},
  paginacion: Paginacion = { page: 1, pageSize: 100 },
): Promise<Pagina<MovimientoPublico>> {
  const tipos = ['ingreso', 'egreso', 'ajuste', 'venta', 'anulacion']
  const tipo = filtro.tipo && tipos.includes(filtro.tipo) ? filtro.tipo : undefined
  return consultarMovimientos({ ...filtro, tipo }, paginacion)
}

export { listarCategorias } from './categorias'
