import { and, asc, desc, eq, like, or, sql } from 'drizzle-orm'
import { db } from '@/db/client'
import { clientes, contadores, facturas, movimientosCuenta, pagos } from '@/db/schema'
import { ApiError } from '@/lib/errors'
import { formatearPesos } from '@/lib/dinero'
import type { ClienteForm, EditarClienteForm, PagoForm } from '@/lib/validation'
import type { Sesion } from './auth'

export type FilaCliente = {
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
}

const saldoSql = sql<number>`coalesce(sum(case when ${movimientosCuenta.tipo} = 'debito' then ${movimientosCuenta.importe} else -${movimientosCuenta.importe} end), 0)`

async function saldosPorCliente() {
  const filas = await db
    .select({ clienteId: movimientosCuenta.clienteId, saldo: saldoSql })
    .from(movimientosCuenta)
    .groupBy(movimientosCuenta.clienteId)

  return new Map(filas.map((fila) => [fila.clienteId, Number(fila.saldo)]))
}

export async function listarClientes(filtro: { q?: string } = {}): Promise<FilaCliente[]> {
  const q = filtro.q?.trim()
  const patron = q ? `%${q}%` : null

  const filas = await db
    .select()
    .from(clientes)
    .where(patron ? or(like(clientes.nombre, patron), like(clientes.nroDoc, patron)) : undefined)
    .orderBy(asc(clientes.nombre))

  const saldos = await saldosPorCliente()

  return filas.map((cliente) => ({
    ...cliente,
    saldo: saldos.get(cliente.id) ?? 0,
  }))
}

export async function obtenerCliente(id: number): Promise<FilaCliente> {
  const [cliente] = await db.select().from(clientes).where(eq(clientes.id, id)).limit(1)

  if (!cliente) throw new ApiError(404, 'CLIENTE_NO_ENCONTRADO', 'El cliente no existe.')

  const [fila] = await db
    .select({ saldo: saldoSql })
    .from(movimientosCuenta)
    .where(eq(movimientosCuenta.clienteId, id))

  return { ...cliente, saldo: Number(fila?.saldo ?? 0) }
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

  return creado
}

export async function editarCliente(id: number, datos: EditarClienteForm) {
  await obtenerCliente(id)
  await documentoLibre(datos.nroDoc, id)

  const [actualizado] = await db
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
    .returning()

  if (!actualizado) {
    throw new ApiError(404, 'CLIENTE_NO_ENCONTRADO', 'El cliente no existe.')
  }

  return actualizado
}

export async function registrarPago(sesion: Sesion, clienteId: number, datos: PagoForm) {
  return db.transaction(async (tx) => {
    const [cliente] = await tx.select().from(clientes).where(eq(clientes.id, clienteId)).limit(1)

    if (!cliente) {
      throw new ApiError(404, 'CLIENTE_NO_ENCONTRADO', 'El cliente no existe.')
    }

    if (!cliente.activo) {
      throw new ApiError(422, 'CLIENTE_INACTIVO', 'El cliente está inactivo y no puede recibir pagos.')
    }

    const [fila] = await tx
      .select({ saldo: saldoSql })
      .from(movimientosCuenta)
      .where(eq(movimientosCuenta.clienteId, clienteId))

    const saldo = Number(fila?.saldo ?? 0)

    if (datos.importe > saldo) {
      throw new ApiError(
        422,
        'PAGO_EXCEDE_SALDO',
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
      })
      .returning()

    await tx.insert(movimientosCuenta).values({
      clienteId,
      tipo: 'credito',
      importe: datos.importe,
      descripcion: `Pago recibo ${String(pago.numero).padStart(8, '0')}`,
      pagoId: pago.id,
    })

    return pago
  })
}

export async function listarMovimientosCuenta(clienteId: number) {
  return db
    .select({
      id: movimientosCuenta.id,
      tipo: movimientosCuenta.tipo,
      importe: movimientosCuenta.importe,
      descripcion: movimientosCuenta.descripcion,
      fecha: movimientosCuenta.fecha,
      facturaId: movimientosCuenta.facturaId,
      pagoId: movimientosCuenta.pagoId,
      facturaNumero: facturas.numero,
      facturaPuntoVenta: facturas.puntoVenta,
      pagoNumero: pagos.numero,
    })
    .from(movimientosCuenta)
    .leftJoin(facturas, eq(movimientosCuenta.facturaId, facturas.id))
    .leftJoin(pagos, eq(movimientosCuenta.pagoId, pagos.id))
    .where(eq(movimientosCuenta.clienteId, clienteId))
    .orderBy(desc(movimientosCuenta.fecha), desc(movimientosCuenta.id))
    .limit(100)
}

/** Clientes activos para elegir en el punto de venta. */
export async function clientesParaVenta() {
  const filas = await listarClientes()
  return filas.filter((cliente) => cliente.activo)
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
