import { and, asc, desc, eq, like, or, sql } from 'drizzle-orm'
import { db } from '@/db/client'
import { clientes, contadores, facturas, movimientosCuenta, pagos, usuarios } from '@/db/schema'
import { ApiError } from '@/lib/errors'
import { formatearNumero, formatearPesos } from '@/lib/dinero'
import type { Pagina, Paginacion } from '@/lib/paginacion'
import type { ClienteForm, EditarClienteForm, PagoForm } from '@/lib/validation'
import type { Sesion } from './auth'

const PUNTO_VENTA = Number(process.env.PUNTO_VENTA ?? 1)

export type ClientePublico = {
  id: number
  tipoDoc: string
  nroDoc: string
  nombre: string
  domicilio: string | null
  telefono: string | null
  email: string | null
  cuentaCorriente: boolean
  limiteCredito: number | null
  saldo: number
  disponible: number | null
  activo: boolean
}

export type MovimientoCuentaPublico = {
  id: number
  fecha: Date
  tipo: 'debito' | 'credito'
  importe: number
  descripcion: string | null
  facturaId: number | null
  pagoId: number | null
  saldo: number
}

const saldoSql = sql<number>`coalesce(sum(case when ${movimientosCuenta.tipo} = 'debito' then ${movimientosCuenta.importe} else -${movimientosCuenta.importe} end), 0)`

/**
 * Saldo por cliente como subconsulta correlacionada: permite filtrar y ordenar
 * por saldo sin traer todos los movimientos a la aplicación.
 */
const saldoPorCliente = sql<number>`(
  select coalesce(sum(case when mc.tipo = 'debito' then mc.importe else -mc.importe end), 0)
  from movimientos_cuenta mc
  where mc.cliente_id = "clientes"."id"
)`

function disponibleDe(cliente: {
  cuentaCorriente: boolean
  limiteCredito: number | null
  saldo: number
}) {
  if (!cliente.cuentaCorriente || cliente.limiteCredito === null) return null
  return Math.max(0, cliente.limiteCredito - cliente.saldo)
}

function aPublico(fila: {
  id: number
  tipoDoc: string
  nroDoc: string
  nombre: string
  domicilio: string | null
  telefono: string | null
  email: string | null
  cuentaCorriente: boolean
  limiteCredito: number | null
  activo: boolean
  saldo: number
}): ClientePublico {
  const saldo = Number(fila.saldo)
  return {
    ...fila,
    saldo,
    disponible: disponibleDe({ ...fila, saldo }),
  }
}

export async function listarClientes(
  filtro: {
    q?: string
    conDeuda?: boolean
    orden?: 'saldo' | 'nombre'
  } & Partial<Paginacion> = {},
): Promise<Pagina<ClientePublico> & { totalAdeudado?: number }> {
  const page = filtro.page ?? 1
  const pageSize = filtro.pageSize ?? 100
  const q = filtro.q?.trim()
  const condiciones = []

  if (q) {
    const patron = `%${q}%`
    const documento = `%${q.replace(/[.\s-]/g, '')}%`
    condiciones.push(
      or(
        like(clientes.nombre, patron),
        sql`replace(replace(${clientes.nroDoc}, '.', ''), '-', '') like ${documento}`,
      ),
    )
  }
  if (filtro.conDeuda) condiciones.push(sql`${saldoPorCliente} > 0`)

  const where = condiciones.length ? and(...condiciones) : undefined

  const [conteo] = await db
    .select({ total: sql<number>`count(*)` })
    .from(clientes)
    .where(where)

  const filas = await db
    .select({
      id: clientes.id,
      tipoDoc: clientes.tipoDoc,
      nroDoc: clientes.nroDoc,
      nombre: clientes.nombre,
      domicilio: clientes.domicilio,
      telefono: clientes.telefono,
      email: clientes.email,
      cuentaCorriente: clientes.cuentaCorriente,
      limiteCredito: clientes.limiteCredito,
      activo: clientes.activo,
      saldo: saldoPorCliente,
    })
    .from(clientes)
    .where(where)
    .orderBy(
      filtro.orden === 'saldo' ? desc(saldoPorCliente) : asc(clientes.nombre),
      asc(clientes.id),
    )
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  const resultado: Pagina<ClientePublico> & { totalAdeudado?: number } = {
    data: filas.map(aPublico),
    page,
    pageSize,
    total: Number(conteo.total),
  }

  if (filtro.conDeuda) {
    const [deuda] = await db
      .select({
        total: sql<number>`coalesce(sum(case when ${saldoPorCliente} > 0 then ${saldoPorCliente} else 0 end), 0)`,
      })
      .from(clientes)
      .where(where)

    resultado.totalAdeudado = Number(deuda.total)
  }

  return resultado
}

export async function obtenerCliente(id: number) {
  const [fila] = await db
    .select({
      id: clientes.id,
      tipoDoc: clientes.tipoDoc,
      nroDoc: clientes.nroDoc,
      nombre: clientes.nombre,
      domicilio: clientes.domicilio,
      telefono: clientes.telefono,
      email: clientes.email,
      cuentaCorriente: clientes.cuentaCorriente,
      limiteCredito: clientes.limiteCredito,
      activo: clientes.activo,
      saldo: saldoPorCliente,
    })
    .from(clientes)
    .where(eq(clientes.id, id))
    .limit(1)

  if (!fila) throw new ApiError(404, 'NO_ENCONTRADO', 'El cliente no existe.')

  const ultimasFacturas = await db
    .select({
      id: facturas.id,
      puntoVenta: facturas.puntoVenta,
      numero: facturas.numero,
      fecha: facturas.fecha,
      total: facturas.total,
      estado: facturas.estado,
    })
    .from(facturas)
    .where(eq(facturas.clienteId, id))
    .orderBy(desc(facturas.fecha), desc(facturas.id))
    .limit(6)

  return { ...aPublico(fila), ultimasFacturas }
}

async function documentoLibre(nroDoc: string, exceptoId?: number) {
  const [existente] = await db
    .select({ id: clientes.id })
    .from(clientes)
    .where(eq(clientes.nroDoc, nroDoc))
    .limit(1)

  if (existente && existente.id !== exceptoId) {
    throw new ApiError(409, 'DOCUMENTO_DUPLICADO', `Ya existe un cliente con el documento ${nroDoc}.`)
  }
}

export async function crearCliente(datos: ClienteForm) {
  await documentoLibre(datos.nroDoc)

  const [creado] = await db
    .insert(clientes)
    .values({
      tipoDoc: datos.tipoDoc,
      nroDoc: datos.nroDoc,
      nombre: datos.nombre,
      domicilio: datos.domicilio,
      telefono: datos.telefono,
      email: datos.email,
      cuentaCorriente: datos.cuentaCorriente,
      limiteCredito: datos.limiteCredito,
      activo: true,
    })
    .returning()

  return aPublico({ ...creado, saldo: 0 })
}

export async function editarCliente(id: number, datos: EditarClienteForm) {
  const actual = await obtenerCliente(id)
  await documentoLibre(datos.nroDoc, id)

  const dejaDeUsarCuenta = actual.cuentaCorriente && !datos.cuentaCorriente
  if ((!datos.activo || dejaDeUsarCuenta) && actual.saldo !== 0) {
    throw new ApiError(
      422,
      'SALDO_PENDIENTE',
      `El cliente tiene un saldo pendiente de ${formatearPesos(actual.saldo)}. Regularizalo antes de dar de baja la cuenta.`,
    )
  }

  await db
    .update(clientes)
    .set({
      tipoDoc: datos.tipoDoc,
      nroDoc: datos.nroDoc,
      nombre: datos.nombre,
      domicilio: datos.domicilio,
      telefono: datos.telefono,
      email: datos.email,
      cuentaCorriente: datos.cuentaCorriente,
      limiteCredito: datos.limiteCredito,
      activo: datos.activo,
    })
    .where(eq(clientes.id, id))

  return obtenerCliente(id)
}

export async function registrarPago(
  sesion: Sesion,
  clienteId: number,
  datos: PagoForm,
  opciones: { fecha?: Date } = {},
) {
  return db.transaction(async (tx) => {
    const [cliente] = await tx.select().from(clientes).where(eq(clientes.id, clienteId)).limit(1)

    if (!cliente) {
      throw new ApiError(404, 'NO_ENCONTRADO', 'El cliente no existe.')
    }

    if (!cliente.activo) {
      throw new ApiError(422, 'VALIDACION', 'El cliente está inactivo y no puede recibir pagos.')
    }

    if (!cliente.cuentaCorriente) {
      throw new ApiError(
        422,
        'CUENTA_CORRIENTE_NO_HABILITADA',
        `${cliente.nombre} no tiene la cuenta corriente habilitada.`,
      )
    }

    const [fila] = await tx
      .select({ saldo: saldoSql })
      .from(movimientosCuenta)
      .where(eq(movimientosCuenta.clienteId, clienteId))

    const saldo = Number(fila?.saldo ?? 0)

    if (datos.importe > saldo) {
      throw new ApiError(
        422,
        'PAGO_SUPERA_DEUDA',
        `El pago supera el saldo deudor de ${formatearPesos(saldo)}.`,
      )
    }

    const [contador] = await tx
      .insert(contadores)
      .values({ nombre: 'recibo', valor: 1 })
      .onConflictDoUpdate({
        target: contadores.nombre,
        set: { valor: sql`${contadores.valor} + 1` },
      })
      .returning()

    const [pago] = await tx
      .insert(pagos)
      .values({
        clienteId,
        numero: contador.valor,
        importe: datos.importe,
        medio: datos.medio,
        observacion: datos.observacion,
        usuarioId: sesion.id,
        ...(opciones.fecha ? { fecha: opciones.fecha } : {}),
      })
      .returning()

    const numeroRecibo = `R ${formatearNumero(PUNTO_VENTA, pago.numero)}`

    await tx.insert(movimientosCuenta).values({
      clienteId,
      tipo: 'credito',
      importe: datos.importe,
      descripcion: `Recibo ${numeroRecibo}`,
      pagoId: pago.id,
      ...(opciones.fecha ? { fecha: opciones.fecha } : {}),
    })

    const [usuario] = await tx
      .select({ id: usuarios.id, nombre: usuarios.nombre })
      .from(usuarios)
      .where(eq(usuarios.id, sesion.id))
      .limit(1)

    return {
      id: pago.id,
      numeroRecibo,
      fecha: pago.fecha,
      cliente: { id: cliente.id, nombre: cliente.nombre },
      importe: pago.importe,
      medio: pago.medio,
      usuario: usuario ?? { id: sesion.id, nombre: sesion.nombre },
      saldoCliente: saldo - datos.importe,
    }
  })
}

export async function obtenerPago(id: number) {
  const [fila] = await db
    .select({
      id: pagos.id,
      numero: pagos.numero,
      fecha: pagos.fecha,
      importe: pagos.importe,
      medio: pagos.medio,
      observacion: pagos.observacion,
      clienteId: clientes.id,
      clienteNombre: clientes.nombre,
      usuarioId: usuarios.id,
      usuarioNombre: usuarios.nombre,
      saldo: saldoPorCliente,
    })
    .from(pagos)
    .innerJoin(clientes, eq(pagos.clienteId, clientes.id))
    .leftJoin(usuarios, eq(pagos.usuarioId, usuarios.id))
    .where(eq(pagos.id, id))
    .limit(1)

  if (!fila) throw new ApiError(404, 'NO_ENCONTRADO', 'El pago no existe.')

  return {
    id: fila.id,
    numeroRecibo: `R ${formatearNumero(PUNTO_VENTA, fila.numero)}`,
    fecha: fila.fecha,
    cliente: { id: fila.clienteId, nombre: fila.clienteNombre },
    importe: fila.importe,
    medio: fila.medio,
    observacion: fila.observacion,
    usuario:
      fila.usuarioId === null
        ? null
        : { id: fila.usuarioId, nombre: fila.usuarioNombre ?? 'Usuario' },
    saldoCliente: Number(fila.saldo),
  }
}

/**
 * Movimientos en orden cronológico con el saldo acumulado en cada renglón
 * (RF-C4). Si `desde` corta el historial, `saldoAnterior` trae lo acumulado.
 */
export async function obtenerCuentaCorriente(
  clienteId: number,
  filtro: { desde?: Date; hasta?: Date } = {},
) {
  const cliente = await obtenerCliente(clienteId)

  const filas = await db
    .select({
      id: movimientosCuenta.id,
      tipo: movimientosCuenta.tipo,
      importe: movimientosCuenta.importe,
      descripcion: movimientosCuenta.descripcion,
      fecha: movimientosCuenta.fecha,
      facturaId: movimientosCuenta.facturaId,
      pagoId: movimientosCuenta.pagoId,
    })
    .from(movimientosCuenta)
    .where(eq(movimientosCuenta.clienteId, clienteId))
    .orderBy(asc(movimientosCuenta.fecha), asc(movimientosCuenta.id))

  let acumulado = 0
  let saldoAnterior = 0
  const movimientos: MovimientoCuentaPublico[] = []

  for (const fila of filas) {
    const delta = fila.tipo === 'debito' ? fila.importe : -fila.importe
    acumulado += delta

    if (filtro.desde && fila.fecha < filtro.desde) {
      saldoAnterior = acumulado
      continue
    }
    if (filtro.hasta && fila.fecha > filtro.hasta) continue

    movimientos.push({
      id: fila.id,
      fecha: fila.fecha,
      tipo: fila.tipo,
      importe: fila.importe,
      descripcion: fila.descripcion,
      facturaId: fila.facturaId,
      pagoId: fila.pagoId,
      saldo: acumulado,
    })
  }

  return {
    cliente: { id: cliente.id, nombre: cliente.nombre },
    saldoAnterior,
    movimientos,
    saldo: acumulado,
  }
}

/** Compatibilidad con la pantalla del cliente: mismo historial, más nuevo primero. */
export async function listarMovimientosCuenta(clienteId: number) {
  const cuenta = await obtenerCuentaCorriente(clienteId)
  return [...cuenta.movimientos].reverse()
}

/** Clientes activos para elegir en el punto de venta. */
export async function clientesParaVenta() {
  const { data } = await listarClientes({ pageSize: 100 })
  return data.filter((cliente) => cliente.activo)
}

/** Saldo y límite disponibles, para validar una venta en cuenta corriente. */
export async function creditoDisponible(clienteId: number) {
  const cliente = await obtenerCliente(clienteId)
  if (!cliente.cuentaCorriente) return 0
  if (cliente.limiteCredito === null) return Number.POSITIVE_INFINITY
  return Math.max(0, cliente.limiteCredito - cliente.saldo)
}

export async function existeClienteActivo(id: number) {
  const [fila] = await db
    .select({ id: clientes.id })
    .from(clientes)
    .where(and(eq(clientes.id, id), eq(clientes.activo, true)))
    .limit(1)
  return Boolean(fila)
}
