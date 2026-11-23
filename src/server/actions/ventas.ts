'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { aCentavos } from '@/lib/dinero'
import { ApiError } from '@/lib/errors'
import { ventaSchema } from '@/lib/validation'
import { requerirSesion } from '@/server/auth'
import { registrarVenta } from '@/server/ventas'

export type EstadoVenta = {
  error?: string
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

  const datos = ventaSchema.safeParse({
    clienteId,
    formaPago: formData.get('formaPago'),
    montoRecibido,
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
