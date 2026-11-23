'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { ApiError } from '@/lib/errors'
import { formatearPesos } from '@/lib/dinero'
import { clienteSchema, editarClienteSchema, pagoSchema } from '@/lib/validation'
import { requerirSesion } from '@/server/auth'
import { crearCliente, editarCliente, registrarPago } from '@/server/clientes'

export type EstadoCliente = {
  error?: string
  ok?: string
  cliente?: {
    id: number
    nombre: string
    nroDoc: string
    cuentaCorriente: boolean
    limiteCredito: number | null
    saldo: number
  }
}

function primerError(issues: { message: string }[]) {
  return issues[0]?.message ?? 'Revisá los datos.'
}

function comoError(error: unknown): string {
  if (error instanceof ApiError) return error.message
  throw error
}

export async function guardarCliente(
  _previo: EstadoCliente,
  formData: FormData,
): Promise<EstadoCliente> {
  await requerirSesion()
  const datos = clienteSchema.safeParse(Object.fromEntries(formData))

  if (!datos.success) return { error: primerError(datos.error.issues) }

  let id: number
  try {
    const creado = await crearCliente(datos.data)
    id = creado.id
  } catch (error) {
    return { error: comoError(error) }
  }

  revalidatePath('/clientes')
  redirect(`/clientes/${id}`)
}

export async function actualizarCliente(
  _previo: EstadoCliente,
  formData: FormData,
): Promise<EstadoCliente> {
  await requerirSesion()
  const id = Number(formData.get('id'))

  if (!Number.isInteger(id) || id <= 0) return { error: 'Cliente inválido.' }

  const datos = editarClienteSchema.safeParse(Object.fromEntries(formData))

  if (!datos.success) return { error: primerError(datos.error.issues) }

  try {
    await editarCliente(id, datos.data)
  } catch (error) {
    return { error: comoError(error) }
  }

  revalidatePath('/clientes')
  revalidatePath(`/clientes/${id}`)
  redirect(`/clientes/${id}`)
}

export async function crearClienteRapido(
  _previo: EstadoCliente,
  formData: FormData,
): Promise<EstadoCliente> {
  await requerirSesion()
  const datos = clienteSchema.safeParse(Object.fromEntries(formData))

  if (!datos.success) return { error: primerError(datos.error.issues) }

  try {
    const creado = await crearCliente(datos.data)
    revalidatePath('/clientes')
    return {
      ok: `${creado.nombre} quedó registrado.`,
      cliente: {
        id: creado.id,
        nombre: creado.nombre,
        nroDoc: creado.nroDoc,
        cuentaCorriente: creado.cuentaCorriente,
        limiteCredito: creado.limiteCredito,
        saldo: 0,
      },
    }
  } catch (error) {
    return { error: comoError(error) }
  }
}

export async function registrarPagoCliente(
  _previo: EstadoCliente,
  formData: FormData,
): Promise<EstadoCliente> {
  const sesion = await requerirSesion()
  const clienteId = Number(formData.get('clienteId'))

  if (!Number.isInteger(clienteId) || clienteId <= 0) {
    return { error: 'Cliente inválido.' }
  }

  const datos = pagoSchema.safeParse(Object.fromEntries(formData))

  if (!datos.success) return { error: primerError(datos.error.issues) }

  try {
    const pago = await registrarPago(sesion, clienteId, datos.data)
    revalidatePath('/clientes')
    revalidatePath(`/clientes/${clienteId}`)
    revalidatePath('/')
    return { ok: `Pago registrado por ${formatearPesos(pago.importe)}.` }
  } catch (error) {
    return { error: comoError(error) }
  }
}
