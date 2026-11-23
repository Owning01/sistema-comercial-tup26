'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { aCentavos } from '@/lib/dinero'
import { ApiError } from '@/lib/errors'
import { ventaSchema } from '@/lib/validation'
import { requerirAdmin, requerirSesion } from '@/server/auth'
import { anularVenta, registrarVenta } from '@/server/ventas'

export type EstadoVenta = {
  error?: string
}

export type EstadoAnulacion = {
  error?: string
  ok?: string
}

function primerError(issues: { message: string }[]) {
  return issues[0]?.message ?? 'Revisá la venta.'
}

export async function confirmarVenta(
  _previo: EstadoVenta,
  formData: FormData,
): Promise<EstadoVenta> {
  const sesion = await requerirSesion()

  let items: unknown
  try {
    items = JSON.parse(String(formData.get('items') ?? '[]'))
  } catch {
    return { error: 'El detalle de la venta llegó dañado. Volvé a intentar.' }
  }

  const clienteCrudo = String(formData.get('clienteId') ?? '').trim()
  const clienteId = clienteCrudo === '' ? null : Number(clienteCrudo)

  const efectivoCrudo = String(formData.get('montoRecibido') ?? '').trim()
  const montoRecibido = efectivoCrudo === '' ? null : aCentavos(efectivoCrudo)

  if (efectivoCrudo !== '' && montoRecibido === null) {
    return { error: 'El efectivo recibido no es un importe válido.' }
  }

  const formaPago = formData.get('formaPago')
  const tarjeta =
    formaPago === 'tarjeta'
      ? {
          tipo: String(formData.get('tarjetaTipo') ?? ''),
          marca: String(formData.get('tarjetaMarca') ?? '').trim(),
          ultimos4: String(formData.get('tarjetaUltimos4') ?? '').trim(),
        }
      : null

  const datos = ventaSchema.safeParse({
    clienteId,
    formaPago,
    montoRecibido,
    tarjeta,
    items,
  })

  if (!datos.success) return { error: primerError(datos.error.issues) }

  let facturaId: number
  try {
    const factura = await registrarVenta(sesion, datos.data)
    facturaId = factura.id
  } catch (error) {
    if (error instanceof ApiError) return { error: error.message }
    throw error
  }

  revalidatePath('/ventas')
  revalidatePath('/productos')
  revalidatePath('/')
  if (datos.data.clienteId) revalidatePath(`/clientes/${datos.data.clienteId}`)
  redirect(`/ventas/${facturaId}`)
}

export async function anularFactura(
  _previo: EstadoAnulacion,
  formData: FormData,
): Promise<EstadoAnulacion> {
  const sesion = await requerirAdmin()
  const facturaId = Number(formData.get('facturaId'))
  const motivo = String(formData.get('motivo') ?? '').trim()

  if (!Number.isInteger(facturaId) || facturaId <= 0) {
    return { error: 'Comprobante inválido.' }
  }

  try {
    const factura = await anularVenta(sesion, facturaId, motivo)
    revalidatePath('/ventas')
    revalidatePath(`/ventas/${facturaId}`)
    revalidatePath('/productos')
    revalidatePath('/')
    if (factura.cliente) revalidatePath(`/clientes/${factura.cliente.id}`)
    return { ok: 'Factura anulada. El stock y la cuenta corriente quedaron actualizados.' }
  } catch (error) {
    if (error instanceof ApiError) return { error: error.message }
    throw error
  }
}
