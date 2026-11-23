import { and, asc, desc, eq, gte, like, lte, or, sql } from 'drizzle-orm'
import { db } from '@/db/client'
import {
  clientes,
  contadores,
  facturaItems,
  facturas,
  movimientosCuenta,
  movimientosStock,
  productos,
  usuarios,
} from '@/db/schema'
import { ApiError } from '@/lib/errors'
import { formatearNumero, formatearPesos } from '@/lib/dinero'
import type { VentaForm } from '@/lib/validation'
import type { Sesion } from './auth'

const PUNTO_VENTA = Number(process.env.PUNTO_VENTA ?? 1)

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

const saldoSql = sql<number>`coalesce(sum(case when ${movimientosCuenta.tipo} = 'debito' then ${movimientosCuenta.importe} else -${movimientosCuenta.importe} end), 0)`

/**
 * Los numeros de comprobante salen de una tabla de contadores. El incremento y
 * el alta de la factura viven en la misma transaccion: si la venta falla, el
 * numero no se consume y no quedan huecos.
 */
async function siguienteNumero(tx: Tx, nombre: string) {
  const [fila] = await tx
    .insert(contadores)
    .values({ nombre, valor: 1 })
    .onConflictDoUpdate({
      target: contadores.nombre,
      set: { valor: sql`${contadores.valor} + 1` },
    })
    .returning()

  return fila.valor
}

export async function registrarVenta(sesion: Sesion, datos: VentaForm) {
  // Si el carrito repite un producto, se suma en un solo renglon.
  const pedidos = new Map<number, number>()
  for (const item of datos.items) {
    pedidos.set(item.productoId, (pedidos.get(item.productoId) ?? 0) + item.cantidad)
  }

  return db.transaction(async (tx) => {
    let cliente: typeof clientes.$inferSelect | null = null

    if (datos.clienteId !== null) {
      const [encontrado] = await tx
        .select()
        .from(clientes)
        .where(eq(clientes.id, datos.clienteId))
        .limit(1)

      if (!encontrado) {
        throw new ApiError(422, 'CLIENTE_INVALIDO', 'El cliente seleccionado no existe.')
      }
      if (!encontrado.activo) {
        throw new ApiError(422, 'CLIENTE_INACTIVO', 'El cliente seleccionado está inactivo.')
      }
      cliente = encontrado
    }

    if (datos.formaPago === 'cuenta_corriente') {
      if (!cliente) {
        throw new ApiError(
          422,
          'CUENTA_SIN_CLIENTE',
          'La venta en cuenta corriente necesita un cliente registrado.',
        )
      }
      if (!cliente.cuentaCorriente) {
        throw new ApiError(
          422,
          'CUENTA_NO_HABILITADA',
          `${cliente.nombre} no tiene la cuenta corriente habilitada.`,
        )
      }
    }

    const renglones: {
      productoId: number
      codigo: string
      descripcion: string
      cantidad: number
      precioUnitario: number
      subtotal: number
      existenciaResultante: number
    }[] = []

    for (const [productoId, cantidad] of pedidos) {
      const [producto] = await tx
        .select({
          id: productos.id,
          codigo: productos.codigo,
          descripcion: productos.descripcion,
          precio: productos.precio,
          existencia: productos.existencia,
          activo: productos.activo,
        })
        .from(productos)
        .where(eq(productos.id, productoId))
        .limit(1)

      if (!producto) {
        throw new ApiError(422, 'PRODUCTO_INVALIDO', 'Uno de los productos ya no existe.')
      }
      if (!producto.activo) {
        throw new ApiError(
          422,
          'PRODUCTO_INACTIVO',
          `${producto.descripcion} está inactivo y no se puede vender.`,
        )
      }
      if (producto.existencia < cantidad) {
        throw new ApiError(
          422,
          'STOCK_INSUFICIENTE',
          `No hay stock suficiente de ${producto.descripcion}. Quedan ${producto.existencia} unidades.`,
        )
      }

      // La condicion viaja en el UPDATE: entre la lectura y la escritura no se
      // puede colar otra venta que deje la existencia en negativo.
      const [actualizado] = await tx
        .update(productos)
        .set({ existencia: sql`${productos.existencia} - ${cantidad}` })
        .where(and(eq(productos.id, productoId), gte(productos.existencia, cantidad)))
        .returning({ existencia: productos.existencia })

      if (!actualizado) {
        throw new ApiError(
          422,
          'STOCK_INSUFICIENTE',
          `No hay stock suficiente de ${producto.descripcion}.`,
        )
      }

      renglones.push({
        productoId,
        codigo: producto.codigo,
        descripcion: producto.descripcion,
        cantidad,
        precioUnitario: producto.precio,
        subtotal: producto.precio * cantidad,
        existenciaResultante: actualizado.existencia,
      })
    }

    const total = renglones.reduce((suma, renglon) => suma + renglon.subtotal, 0)

    if (datos.formaPago === 'contado') {
      if (datos.montoRecibido === null) {
        throw new ApiError(422, 'FALTA_EFECTIVO', 'Ingresá el efectivo recibido.')
      }
      if (datos.montoRecibido < total) {
        throw new ApiError(
          422,
          'EFECTIVO_INSUFICIENTE',
          `El efectivo recibido no alcanza. Faltan ${formatearPesos(total - datos.montoRecibido)}.`,
        )
      }
    }

    if (datos.formaPago === 'cuenta_corriente' && cliente && cliente.limiteCredito !== null) {
      const [fila] = await tx
        .select({ saldo: saldoSql })
        .from(movimientosCuenta)
        .where(eq(movimientosCuenta.clienteId, cliente.id))

      const saldo = Number(fila?.saldo ?? 0)
      const disponible = cliente.limiteCredito - saldo

      if (total > disponible) {
        throw new ApiError(
          422,
          'LIMITE_EXCEDIDO',
          `La venta supera el crédito disponible de ${formatearPesos(Math.max(0, disponible))}.`,
        )
      }
    }

    const numero = await siguienteNumero(tx, `factura:${String(PUNTO_VENTA).padStart(4, '0')}`)

    const [factura] = await tx
      .insert(facturas)
      .values({
        puntoVenta: PUNTO_VENTA,
        numero,
        clienteId: cliente?.id ?? null,
        clienteNombre: cliente?.nombre ?? null,
        clienteDocumento: cliente?.nroDoc ?? null,
        total,
        formaPago: datos.formaPago,
        montoRecibido: datos.formaPago === 'contado' ? datos.montoRecibido : null,
        vuelto:
          datos.formaPago === 'contado' && datos.montoRecibido !== null
            ? datos.montoRecibido - total
            : null,
        usuarioId: sesion.id,
      })
      .returning()

    await tx.insert(facturaItems).values(
      renglones.map((renglon) => ({
        facturaId: factura.id,
        productoId: renglon.productoId,
        codigo: renglon.codigo,
        descripcion: renglon.descripcion,
        cantidad: renglon.cantidad,
        precioUnitario: renglon.precioUnitario,
        subtotal: renglon.subtotal,
      })),
    )

    await tx.insert(movimientosStock).values(
      renglones.map((renglon) => ({
        productoId: renglon.productoId,
        tipo: 'venta',
        cantidad: -renglon.cantidad,
        existenciaResultante: renglon.existenciaResultante,
        motivo: `Venta ${formatearNumero(PUNTO_VENTA, numero)}`,
        facturaId: factura.id,
        usuarioId: sesion.id,
      })),
    )

    if (datos.formaPago === 'cuenta_corriente' && cliente) {
      await tx.insert(movimientosCuenta).values({
        clienteId: cliente.id,
        tipo: 'debito',
        importe: total,
        descripcion: `Factura ${formatearNumero(PUNTO_VENTA, numero)}`,
        facturaId: factura.id,
      })
    }

    return factura
  })
}

export async function listarVentas(filtro: { q?: string } = {}) {
  const q = filtro.q?.trim()
  const patron = q ? `%${q}%` : null

  return db
    .select({
      id: facturas.id,
      puntoVenta: facturas.puntoVenta,
      numero: facturas.numero,
      fecha: facturas.fecha,
      clienteNombre: facturas.clienteNombre,
      total: facturas.total,
      formaPago: facturas.formaPago,
      estado: facturas.estado,
    })
    .from(facturas)
    .where(
      patron
        ? or(
            like(facturas.clienteNombre, patron),
            sql`cast(${facturas.numero} as text) like ${patron}`,
          )
        : undefined,
    )
    .orderBy(desc(facturas.fecha), desc(facturas.id))
    .limit(100)
}

export async function obtenerVenta(id: number) {
  const [factura] = await db
    .select({
      id: facturas.id,
      puntoVenta: facturas.puntoVenta,
      numero: facturas.numero,
      fecha: facturas.fecha,
      clienteId: facturas.clienteId,
      clienteNombre: facturas.clienteNombre,
      clienteDocumento: facturas.clienteDocumento,
      total: facturas.total,
      formaPago: facturas.formaPago,
      montoRecibido: facturas.montoRecibido,
      vuelto: facturas.vuelto,
      estado: facturas.estado,
      usuarioNombre: usuarios.nombre,
    })
    .from(facturas)
    .leftJoin(usuarios, eq(facturas.usuarioId, usuarios.id))
    .where(eq(facturas.id, id))
    .limit(1)

  if (!factura) {
    throw new ApiError(404, 'VENTA_NO_ENCONTRADA', 'El comprobante no existe.')
  }

  const items = await db
    .select()
    .from(facturaItems)
    .where(eq(facturaItems.facturaId, id))
    .orderBy(asc(facturaItems.id))

  return { factura, items }
}

export async function resumenVentas() {
  const [hoy] = await db
    .select({
      cantidad: sql<number>`count(*)`,
      total: sql<number>`coalesce(sum(${facturas.total}), 0)`,
    })
    .from(facturas)
    .where(
      and(
        eq(facturas.estado, 'emitida'),
        sql`date(${facturas.fecha}, 'unixepoch', '-3 hours') = date('now', '-3 hours')`,
      ),
    )

  const [mes] = await db
    .select({
      cantidad: sql<number>`count(*)`,
      total: sql<number>`coalesce(sum(${facturas.total}), 0)`,
    })
    .from(facturas)
    .where(
      and(
        eq(facturas.estado, 'emitida'),
        sql`strftime('%Y-%m', ${facturas.fecha}, 'unixepoch', '-3 hours') = strftime('%Y-%m', 'now', '-3 hours')`,
      ),
    )

  const [hoyCuenta] = await db
    .select({ total: sql<number>`coalesce(sum(${facturas.total}), 0)` })
    .from(facturas)
    .where(
      and(
        eq(facturas.estado, 'emitida'),
        eq(facturas.formaPago, 'cuenta_corriente'),
        sql`date(${facturas.fecha}, 'unixepoch', '-3 hours') = date('now', '-3 hours')`,
      ),
    )

  const [deuda] = await db
    .select({ total: saldoSql })
    .from(movimientosCuenta)

  const [bajoConteo] = await db
    .select({ n: sql<number>`count(*)` })
    .from(productos)
    .where(and(eq(productos.activo, true), lte(productos.existencia, productos.stockMinimo)))

  const bajoMinimo = await db
    .select({
      id: productos.id,
      codigo: productos.codigo,
      descripcion: productos.descripcion,
      existencia: productos.existencia,
      stockMinimo: productos.stockMinimo,
    })
    .from(productos)
    .where(and(eq(productos.activo, true), lte(productos.existencia, productos.stockMinimo)))
    .orderBy(asc(productos.existencia))
    .limit(6)

  const ultimas = await db
    .select({
      id: facturas.id,
      numero: facturas.numero,
      puntoVenta: facturas.puntoVenta,
      fecha: facturas.fecha,
      clienteNombre: facturas.clienteNombre,
      total: facturas.total,
      formaPago: facturas.formaPago,
    })
    .from(facturas)
    .where(eq(facturas.estado, 'emitida'))
    .orderBy(desc(facturas.fecha), desc(facturas.id))
    .limit(5)

  return {
    hoy: { cantidad: Number(hoy.cantidad), total: Number(hoy.total) },
    hoyCuenta: Number(hoyCuenta.total),
    mes: { cantidad: Number(mes.cantidad), total: Number(mes.total) },
    deuda: Number(deuda.total),
    bajoMinimo,
    bajoMinimoTotal: Number(bajoConteo.n),
    ultimas,
  }
}
