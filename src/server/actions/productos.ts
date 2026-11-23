'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { ApiError } from '@/lib/errors'
import { editarProductoSchema, movimientoSchema, productoSchema } from '@/lib/validation'
import { requerirSesion } from '@/server/auth'
import { crearProducto, editarProducto, moverStock } from '@/server/productos'

export type EstadoProducto = {
  error?: string
}

export type EstadoMovimiento = {
  error?: string
  ok?: string
}

/** El primer mensaje de Zod alcanza: el formulario muestra uno por vez. */
function primerError(issues: { message: string }[]) {
  return issues[0]?.message ?? 'Revisá los datos.'
}

/** Un ApiError es un mensaje para el usuario; lo demas es un bug. */
function comoError(error: unknown): string {
  if (error instanceof ApiError) return error.message
  throw error
}

export async function guardarProducto(
  _previo: EstadoProducto,
  formData: FormData,
): Promise<EstadoProducto> {
  const sesion = await requerirSesion()
  const datos = productoSchema.safeParse(Object.fromEntries(formData))

  if (!datos.success) {
    return { error: primerError(datos.error.issues) }
  }

  try {
    await crearProducto(sesion, datos.data)
  } catch (error) {
    return { error: comoError(error) }
  }

  revalidatePath('/productos')
  redirect('/productos')
}

export async function actualizarProducto(
  _previo: EstadoProducto,
  formData: FormData,
): Promise<EstadoProducto> {
  await requerirSesion()
  const id = Number(formData.get('id'))

  if (!Number.isInteger(id) || id <= 0) {
    return { error: 'Producto inválido.' }
  }

  const datos = editarProductoSchema.safeParse(Object.fromEntries(formData))

  if (!datos.success) {
    return { error: primerError(datos.error.issues) }
  }

  try {
    await editarProducto(id, datos.data)
  } catch (error) {
    return { error: comoError(error) }
  }

  revalidatePath('/productos')
  revalidatePath(`/productos/${id}`)
  redirect(`/productos/${id}`)
}

export async function registrarMovimiento(
  _previo: EstadoMovimiento,
  formData: FormData,
): Promise<EstadoMovimiento> {
  const sesion = await requerirSesion()
  const productoId = Number(formData.get('productoId'))

  if (!Number.isInteger(productoId) || productoId <= 0) {
    return { error: 'Producto inválido.' }
  }

  const datos = movimientoSchema.safeParse(Object.fromEntries(formData))

  if (!datos.success) {
    return { error: primerError(datos.error.issues) }
  }

  try {
    const movimiento = await moverStock(sesion, productoId, datos.data)
    revalidatePath('/productos')
    revalidatePath(`/productos/${productoId}`)
    return {
      ok: `Movimiento registrado. La existencia quedó en ${movimiento.existenciaResultante}.`,
    }
  } catch (error) {
    return { error: comoError(error) }
  }
}
