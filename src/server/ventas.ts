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
import type { Pagina, Paginacion } from '@/lib/paginacion'
import type { VentaForm } from '@/lib/validation'
import type { Sesion } from './auth'
import { exigirAdmin } from './permisos'

const PUNTO_VENTA = Number(process.env.PUNTO_VENTA ?? 1)

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

const saldoSql = sql<number>`coalesce(sum(case when ${movimientosCuenta.tipo} = 'debito' then ${movimientosCuenta.importe} else -${movimientosCuenta.importe} end), 0)`

/**
 * Los números de comprobante salen de una tabla de contadores. El incremento y
 * el alta de la factura viven en la misma transacción: si la venta falla, el
 * número no se consume y no quedan huecos (RF-V1).
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

export async function registrarVenta(
  sesion: Sesion,
  datos: VentaForm,
  opciones: { fecha?: Date } = {},
) {
  if (datos.formaPago === 'tarjeta' && !datos.tarjeta) {
    throw new ApiError(422, 'VALIDACION', 'Faltan los datos de la tarjeta.', [
      { campo: 'pago.tarjeta', mensaje: 'Indicá tipo, marca y últimos 4 dígitos.' },
    ])
  }

  // Si el carrito repite un producto, se suma en un solo renglón.
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
        throw new ApiError(422, 'VALIDACION', 'El cliente seleccionado no existe.', [
          { campo: 'clienteId', mensaje: 'El cliente no existe.' },
        ])
      }
      if (!encontrado.activo) {
        throw new ApiError(422, 'VALIDACION', 'El cliente seleccionado está inactivo.', [
          { campo: 'clienteId', mensaje: 'El cliente está inactivo.' },
        ])
      }
      cliente = encontrado
    }

    if (datos.formaPago === 'cuenta_corriente') {
      if (!cliente) {
        throw new ApiError(
          422,
          'CUENTA_CORRIENTE_NO_HABILITADA',
          'La venta en cuenta corriente necesita un cliente registrado.',
        )
      }
      if (!cliente.cuentaCorriente) {
        throw new ApiError(
          422,
          'CUENTA_CORRIENTE_NO_HABILITADA',
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
    const faltantes: { productoId: number; solicitado: number; disponible: number }[] = []

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
        throw new ApiError(422, 'VALIDACION', 'Uno de los productos ya no existe.', [
          { campo: 'items', mensaje: `El producto ${productoId} no existe.` },
        ])
      }
      if (!producto.activo) {
        throw new ApiError(
          422,
          'PRODUCTO_INACTIVO',
          `${producto.descripcion} está inactivo y no se puede vender.`,
          [{ productoId, mensaje: `${producto.descripcion} está inactivo.` }],
        )
      }
      if (producto.existencia < cantidad) {
        faltantes.push({ productoId, solicitado: cantidad, disponible: producto.existencia })
        continue
      }

      renglones.push({
        productoId,
        codigo: producto.codigo,
        descripcion: producto.descripcion,
        cantidad,
        precioUnitario: producto.precio,
        subtotal: producto.precio * cantidad,
        existenciaResultante: producto.existencia - cantidad,
      })
    }

    if (faltantes.length > 0) {
      throw new ApiError(
        409,
        'STOCK_INSUFICIENTE',
        'No hay stock suficiente para completar la venta.',
        faltantes,
      )
    }

    const total = renglones.reduce((suma, renglon) => suma + renglon.subtotal, 0)

    let montoRecibido: number | null = null
    let vuelto: number | null = null

    if (datos.formaPago === 'contado') {
      montoRecibido = datos.montoRecibido ?? total
      if (montoRecibido < total) {
        throw new ApiError(
          422,
          'MONTO_INSUFICIENTE',
          `El efectivo recibido no alcanza. Faltan ${formatearPesos(total - montoRecibido)}.`,
          [{ total, montoRecibido, faltante: total - montoRecibido }],
        )
      }
      vuelto = montoRecibido - total
    }

    let saldoCliente: number | null = null

    if (datos.formaPago === 'cuenta_corriente' && cliente) {
      const [fila] = await tx
        .select({ saldo: saldoSql })
        .from(movimientosCuenta)
        .where(eq(movimientosCuenta.clienteId, cliente.id))

      saldoCliente = Number(fila?.saldo ?? 0) + total

      if (cliente.limiteCredito !== null && saldoCliente > cliente.limiteCredito) {
        const saldoActual = saldoCliente - total
        throw new ApiError(
          422,
          'LIMITE_CREDITO_EXCEDIDO',
          `La venta supera el crédito disponible de ${formatearPesos(
            Math.max(0, cliente.limiteCredito - saldoActual),
          )}.`,
          {
            saldoActual,
            limite: cliente.limiteCredito,
            excedente: saldoCliente - cliente.limiteCredito,
          },
        )
      }
    }

    const numero = await siguienteNumero(tx, `factura:${String(PUNTO_VENTA).padStart(4, '0')}`)

    const [factura] = await tx
      .insert(facturas)
      .values({
        puntoVenta: PUNTO_VENTA,
        numero,
        ...(opciones.fecha ? { fecha: opciones.fecha } : {}),
        clienteId: cliente?.id ?? null,
        clienteNombre: cliente?.nombre ?? null,
        clienteDocumento: cliente?.nroDoc ?? null,
        total,
        formaPago: datos.formaPago,
        montoRecibido,
        vuelto,
        tarjetaTipo: datos.tarjeta?.tipo ?? null,
        tarjetaMarca: datos.tarjeta?.marca ?? null,
        tarjetaUltimos4: datos.tarjeta?.ultimos4 ?? null,
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

    // La condición viaja en el UPDATE: entre la lectura y la escritura no se
    // puede colar otra venta que deje la existencia en negativo.
    for (const renglon of renglones) {
      const [actualizado] = await tx
        .update(productos)
        .set({ existencia: sql`${productos.existencia} - ${renglon.cantidad}` })
        .where(
          and(eq(productos.id, renglon.productoId), gte(productos.existencia, renglon.cantidad)),
        )
        .returning({ existencia: productos.existencia })

      if (!actualizado) {
        throw new ApiError(
          409,
          'STOCK_INSUFICIENTE',
          `No hay stock suficiente de ${renglon.descripcion}.`,
          [
            {
              productoId: renglon.productoId,
              solicitado: renglon.cantidad,
              disponible: 0,
            },
          ],
        )
      }

      await tx.insert(movimientosStock).values({
        productoId: renglon.productoId,
        tipo: 'venta',
        cantidad: -renglon.cantidad,
        existenciaResultante: actualizado.existencia,
        motivo: `Venta ${formatearNumero(PUNTO_VENTA, numero)}`,
        facturaId: factura.id,
        usuarioId: sesion.id,
        ...(opciones.fecha ? { fecha: opciones.fecha } : {}),
      })
    }

    if (datos.formaPago === 'cuenta_corriente' && cliente) {
      await tx.insert(movimientosCuenta).values({
        clienteId: cliente.id,
        tipo: 'debito',
        importe: total,
        descripcion: `Factura ${formatearNumero(PUNTO_VENTA, numero)}`,
        facturaId: factura.id,
        ...(opciones.fecha ? { fecha: opciones.fecha } : {}),
      })
    }

    return factura
  })
}

/** Datos del comprobante con el cliente y el vendedor completos. */
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
      tarjetaTipo: facturas.tarjetaTipo,
      tarjetaMarca: facturas.tarjetaMarca,
      tarjetaUltimos4: facturas.tarjetaUltimos4,
      motivoAnulacion: facturas.motivoAnulacion,
      anuladaEn: facturas.anuladaEn,
      anuladaPorId: facturas.anuladaPorId,
      usuarioId: facturas.usuarioId,
    })
    .from(facturas)
    .where(eq(facturas.id, id))
    .limit(1)

  if (!factura) {
    throw new ApiError(404, 'NO_ENCONTRADO', 'El comprobante no existe.')
  }

  const items = await db
    .select()
    .from(facturaItems)
    .where(eq(facturaItems.facturaId, id))
    .orderBy(asc(facturaItems.id))

  const cliente = factura.clienteId
    ? ((
        await db
          .select({
            id: clientes.id,
            nombre: clientes.nombre,
            tipoDoc: clientes.tipoDoc,
            nroDoc: clientes.nroDoc,
            domicilio: clientes.domicilio,
          })
          .from(clientes)
          .where(eq(clientes.id, factura.clienteId))
          .limit(1)
      )[0] ?? null)
    : null

  const [vendedor] = factura.usuarioId
    ? await db
        .select({ id: usuarios.id, nombre: usuarios.nombre })
        .from(usuarios)
        .where(eq(usuarios.id, factura.usuarioId))
        .limit(1)
    : []

  const [anulador] = factura.anuladaPorId
    ? await db
        .select({ id: usuarios.id, nombre: usuarios.nombre })
        .from(usuarios)
        .where(eq(usuarios.id, factura.anuladaPorId))
        .limit(1)
    : []

  return { factura, items, cliente, vendedor: vendedor ?? null, anulador: anulador ?? null }
}

export async function obtenerFacturaPublica(id: number) {
  const { factura, items, cliente, vendedor, anulador } = await obtenerVenta(id)

  let saldoCliente: number | null = null
  if (factura.formaPago === 'cuenta_corriente' && factura.clienteId) {
    const [fila] = await db
      .select({ saldo: saldoSql })
      .from(movimientosCuenta)
      .where(eq(movimientosCuenta.clienteId, factura.clienteId))
    saldoCliente = Number(fila?.saldo ?? 0)
  }

  return {
    id: factura.id,
    puntoVenta: factura.puntoVenta,
    numero: factura.numero,
    numeroFormateado: formatearNumero(factura.puntoVenta, factura.numero),
    fecha: factura.fecha,
    estado: factura.estado,
    cliente: cliente
      ? {
          id: cliente.id,
          nombre: cliente.nombre,
          tipoDoc: cliente.tipoDoc,
          nroDoc: cliente.nroDoc,
          domicilio: cliente.domicilio,
        }
      : null,
    vendedor: vendedor ?? null,
    items: items.map((item) => ({
      productoId: item.productoId,
      codigo: item.codigo,
      descripcion: item.descripcion,
      cantidad: item.cantidad,
      precioUnitario: item.precioUnitario,
      subtotal: item.subtotal,
    })),
    total: factura.total,
    pago:
      factura.formaPago === 'contado'
        ? {
            forma: 'contado',
            montoRecibido: factura.montoRecibido,
            vuelto: factura.vuelto,
          }
        : factura.formaPago === 'tarjeta'
          ? {
              forma: 'tarjeta',
              tarjeta: {
                tipo: factura.tarjetaTipo,
                marca: factura.tarjetaMarca,
                ultimos4: factura.tarjetaUltimos4,
              },
            }
          : { forma: 'cuenta_corriente' },
    ...(saldoCliente === null ? {} : { saldoCliente }),
    ...(factura.estado === 'anulada'
      ? {
          anulacion: {
            fecha: factura.anuladaEn,
            motivo: factura.motivoAnulacion,
            usuario: anulador,
          },
        }
      : {}),
  }
}

export type FiltroVentas = {
  q?: string
  desde?: Date
  hasta?: Date
  clienteId?: number
  vendedorId?: number
  forma?: string
  estado?: string
}

function condicionesVentas(filtro: FiltroVentas) {
  const condiciones = []
  const q = filtro.q?.trim()

  if (q) {
    const patron = `%${q}%`
    condiciones.push(
      or(
        like(facturas.clienteNombre, patron),
        sql`cast(${facturas.numero} as text) like ${patron}`,
        sql`printf('%04d-%08d', ${facturas.puntoVenta}, ${facturas.numero}) like ${patron}`,
      ),
    )
  }
  if (filtro.desde) condiciones.push(gte(facturas.fecha, filtro.desde))
  if (filtro.hasta) condiciones.push(lte(facturas.fecha, filtro.hasta))
  if (filtro.clienteId) condiciones.push(eq(facturas.clienteId, filtro.clienteId))
  if (filtro.vendedorId) condiciones.push(eq(facturas.usuarioId, filtro.vendedorId))
  if (filtro.forma) condiciones.push(eq(facturas.formaPago, filtro.forma as 'contado'))
  if (filtro.estado) condiciones.push(eq(facturas.estado, filtro.estado as 'emitida'))

  return condiciones.length ? and(...condiciones) : undefined
}

export async function listarVentas(
  filtro: FiltroVentas = {},
  paginacion: Paginacion = { page: 1, pageSize: 20 },
): Promise<Pagina<{
  id: number
  puntoVenta: number
  numero: number
  fecha: Date
  clienteNombre: string | null
  total: number
  formaPago: string
  estado: string
}> & { totalEmitido: number }> {
  const where = condicionesVentas(filtro)

  const [conteo] = await db
    .select({ total: sql<number>`count(*)` })
    .from(facturas)
    .where(where)

  const filas = await db
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
    .where(where)
    .orderBy(desc(facturas.fecha), desc(facturas.id))
    .limit(paginacion.pageSize)
    .offset((paginacion.page - 1) * paginacion.pageSize)

  const [emitidas] = await db
    .select({ total: sql<number>`coalesce(sum(${facturas.total}), 0)` })
    .from(facturas)
    .where(and(where, eq(facturas.estado, 'emitida')))

  return {
    data: filas,
    page: paginacion.page,
    pageSize: paginacion.pageSize,
    total: Number(conteo.total),
    totalEmitido: Number(emitidas.total),
  }
}

/** RF-V9: anular no borra. Reingresa stock y acredita la cuenta si era a cuenta. */
export async function anularVenta(sesion: Sesion, id: number, motivo: string) {
  exigirAdmin(sesion)

  const limpio = motivo.trim()
  if (limpio.length < 3) {
    throw new ApiError(422, 'VALIDACION', 'Indicá el motivo de la anulación.', [
      { campo: 'motivo', mensaje: 'El motivo es obligatorio.' },
    ])
  }

  await db.transaction(async (tx) => {
    const [factura] = await tx
      .select({
        id: facturas.id,
        estado: facturas.estado,
        numero: facturas.numero,
        puntoVenta: facturas.puntoVenta,
      })
      .from(facturas)
      .where(eq(facturas.id, id))
      .limit(1)

    if (!factura) throw new ApiError(404, 'NO_ENCONTRADO', 'El comprobante no existe.')
    if (factura.estado === 'anulada') {
      throw new ApiError(409, 'FACTURA_ANULADA', 'La factura ya estaba anulada.')
    }

    const [actualizada] = await tx
      .update(facturas)
      .set({
        estado: 'anulada',
        motivoAnulacion: limpio,
        anuladaEn: new Date(),
        anuladaPorId: sesion.id,
      })
      .where(and(eq(facturas.id, id), eq(facturas.estado, 'emitida')))
      .returning({ id: facturas.id })

    if (!actualizada) {
      throw new ApiError(409, 'FACTURA_ANULADA', 'La factura ya estaba anulada.')
    }

    const items = await tx.select().from(facturaItems).where(eq(facturaItems.facturaId, id))

    for (const item of items) {
      const [producto] = await tx
        .update(productos)
        .set({ existencia: sql`${productos.existencia} + ${item.cantidad}` })
        .where(eq(productos.id, item.productoId))
        .returning({ existencia: productos.existencia })

      if (!producto) continue

      await tx.insert(movimientosStock).values({
        productoId: item.productoId,
        tipo: 'anulacion',
        cantidad: item.cantidad,
        existenciaResultante: producto.existencia,
        motivo: `Anulación ${formatearNumero(factura.puntoVenta ?? PUNTO_VENTA, factura.numero)}`,
        facturaId: id,
        usuarioId: sesion.id,
      })
    }

    const [completa] = await tx
      .select({
        formaPago: facturas.formaPago,
        clienteId: facturas.clienteId,
        total: facturas.total,
      })
      .from(facturas)
      .where(eq(facturas.id, id))
      .limit(1)

    if (completa?.formaPago === 'cuenta_corriente' && completa.clienteId) {
      await tx.insert(movimientosCuenta).values({
        clienteId: completa.clienteId,
        tipo: 'credito',
        importe: completa.total,
        descripcion: `Anulación Factura ${formatearNumero(PUNTO_VENTA, factura.numero)}`,
        facturaId: id,
      })
    }
  })

  return obtenerFacturaPublica(id)
}

export async function proximoNumeroFactura() {
  const [fila] = await db
    .select({ valor: contadores.valor })
    .from(contadores)
    .where(eq(contadores.nombre, `factura:${String(PUNTO_VENTA).padStart(4, '0')}`))
    .limit(1)

  return {
    numeroFormateado: formatearNumero(PUNTO_VENTA, Number(fila?.valor ?? 0) + 1),
  }
}

/** Resumen de la pantalla del tablero (RF-T1 a RF-T3). */
export async function resumenTablero() {
  const [hoy] = await db
    .select({
      cantidad: sql<number>`count(*)`,
      importe: sql<number>`coalesce(sum(${facturas.total}), 0)`,
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
      importe: sql<number>`coalesce(sum(${facturas.total}), 0)`,
    })
    .from(facturas)
    .where(
      and(
        eq(facturas.estado, 'emitida'),
        sql`strftime('%Y-%m', ${facturas.fecha}, 'unixepoch', '-3 hours') = strftime('%Y-%m', 'now', '-3 hours')`,
      ),
    )

  const saldos = await db
    .select({ saldo: sql<number>`(
      select coalesce(sum(case when mc.tipo = 'debito' then mc.importe else -mc.importe end), 0)
      from movimientos_cuenta mc
      where mc.cliente_id = "clientes"."id"
    )` })
    .from(clientes)

  const conSaldo = saldos.map((fila) => Number(fila.saldo)).filter((saldo) => saldo > 0)

  const [bajo] = await db
    .select({ cantidad: sql<number>`count(*)` })
    .from(productos)
    .where(and(eq(productos.activo, true), lte(productos.existencia, productos.stockMinimo)))

  const desde = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const diarias = await db
    .select({
      dia: sql<string>`date(${facturas.fecha}, 'unixepoch', '-3 hours')`,
      importe: sql<number>`coalesce(sum(${facturas.total}), 0)`,
    })
    .from(facturas)
    .where(and(eq(facturas.estado, 'emitida'), gte(facturas.fecha, desde)))
    .groupBy(sql`date(${facturas.fecha}, 'unixepoch', '-3 hours')`)

  const porDia = new Map(diarias.map((fila) => [fila.dia, Number(fila.importe)]))
  const dias: { fecha: string; importe: number }[] = []
  const base = new Date(Date.now() - 3 * 60 * 60 * 1000)
  const anio = base.getUTCFullYear()
  const mesActual = base.getUTCMonth()
  const diaActual = base.getUTCDate()

  for (let i = 29; i >= 0; i--) {
    const fecha = new Date(Date.UTC(anio, mesActual, diaActual - i))
    const clave = fecha.toISOString().slice(0, 10)
    dias.push({ fecha: clave, importe: porDia.get(clave) ?? 0 })
  }

  const formas = await db
    .select({
      forma: facturas.formaPago,
      importe: sql<number>`coalesce(sum(${facturas.total}), 0)`,
    })
    .from(facturas)
    .where(
      and(
        eq(facturas.estado, 'emitida'),
        sql`strftime('%Y-%m', ${facturas.fecha}, 'unixepoch', '-3 hours') = strftime('%Y-%m', 'now', '-3 hours')`,
      ),
    )
    .groupBy(facturas.formaPago)

  const porForma = new Map(formas.map((fila) => [fila.forma, Number(fila.importe)]))

  const masVendidos = await db
    .select({
      productoId: productos.id,
      codigo: productos.codigo,
      descripcion: productos.descripcion,
      unidades: sql<number>`sum(${facturaItems.cantidad})`,
      importe: sql<number>`sum(${facturaItems.subtotal})`,
    })
    .from(facturaItems)
    .innerJoin(facturas, eq(facturaItems.facturaId, facturas.id))
    .innerJoin(productos, eq(facturaItems.productoId, productos.id))
    .where(
      and(
        eq(facturas.estado, 'emitida'),
        sql`strftime('%Y-%m', ${facturas.fecha}, 'unixepoch', '-3 hours') = strftime('%Y-%m', 'now', '-3 hours')`,
      ),
    )
    .groupBy(productos.id, productos.codigo, productos.descripcion)
    .orderBy(desc(sql`sum(${facturaItems.cantidad})`))
    .limit(5)

  const importeMes = Number(mes.importe)
  const cantidadMes = Number(mes.cantidad)

  return {
    hoy: { cantidad: Number(hoy.cantidad), importe: Number(hoy.importe) },
    mes: {
      cantidad: cantidadMes,
      importe: importeMes,
      ticketPromedio: cantidadMes > 0 ? Math.round(importeMes / cantidadMes) : 0,
    },
    cuentasCorrientes: {
      totalAdeudado: conSaldo.reduce((suma, saldo) => suma + saldo, 0),
      clientesConSaldo: conSaldo.length,
    },
    bajoMinimo: { cantidad: Number(bajo.cantidad) },
    ventasDiarias: dias,
    porFormaDePago: (['contado', 'tarjeta', 'cuenta_corriente'] as const).map((forma) => ({
      forma,
      importe: porForma.get(forma) ?? 0,
    })),
    masVendidos: masVendidos.map((fila) => ({
      productoId: fila.productoId,
      codigo: fila.codigo,
      descripcion: fila.descripcion,
      unidades: Number(fila.unidades),
      importe: Number(fila.importe),
    })),
  }
}

/** Resumen liviano que usa la pantalla de inicio además de los gráficos. */
export async function resumenVentas() {
  const tablero = await resumenTablero()

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

  const [deuda] = await db.select({ total: saldoSql }).from(movimientosCuenta)

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

  return {
    hoy: { cantidad: tablero.hoy.cantidad, total: tablero.hoy.importe },
    hoyCuenta: Number(hoyCuenta.total),
    mes: { cantidad: tablero.mes.cantidad, total: tablero.mes.importe },
    deuda: Number(deuda.total),
    bajoMinimo,
    bajoMinimoTotal: tablero.bajoMinimo.cantidad,
    ultimas,
  }
}
