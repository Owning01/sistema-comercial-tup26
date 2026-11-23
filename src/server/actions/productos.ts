'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { ApiError } from '@/lib/errors'
import { categoriaSchema, editarProductoSchema, movimientoSchema, productoSchema } from '@/lib/validation'
import { requerirAdmin, requerirSesion } from '@/server/auth'
import { crearCategoria, editarCategoria } from '@/server/categorias'
import { crearProducto, editarProducto, moverStock } from '@/server/productos'

export type EstadoProducto = {
  error?: string
}

export type EstadoCategoria = {
  error?: string
  ok?: string
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
  const sesion = await requerirSesion()
  const id = Number(formData.get('id'))

  if (!Number.isInteger(id) || id <= 0) {
    return { error: 'Producto inválido.' }
  }

  const datos = editarProductoSchema.safeParse(Object.fromEntries(formData))

  if (!datos.success) {
    return { error: primerError(datos.error.issues) }
  }

  try {
    await editarProducto(sesion, id, datos.data)
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

/** Igual que registrarMovimiento, pero vuelve al historial global. */
export async function registrarMovimientoGlobal(
  previo: EstadoMovimiento,
  formData: FormData,
): Promise<EstadoMovimiento> {
  const resultado = await registrarMovimiento(previo, formData)
  if (resultado.error) return resultado

  revalidatePath('/productos/movimientos')
  redirect('/productos/movimientos')
}

export async function guardarCategoria(
  _previo: EstadoCategoria,
  formData: FormData,
): Promise<EstadoCategoria> {
  const sesion = await requerirAdmin()
  const datos = categoriaSchema.safeParse(Object.fromEntries(formData))

  if (!datos.success) return { error: primerError(datos.error.issues) }

  try {
    await crearCategoria(sesion, datos.data.nombre)
  } catch (error) {
    return { error: comoError(error) }
  }

  revalidatePath('/productos')
  revalidatePath('/productos/categorias')
  return { ok: 'Categoría creada.' }
}

export async function alternarCategoria(
  _previo: EstadoCategoria,
  formData: FormData,
): Promise<EstadoCategoria> {
  const sesion = await requerirAdmin()
  const id = Number(formData.get('id'))
  const activa = String(formData.get('activa')) === 'true'

  if (!Number.isInteger(id) || id <= 0) return { error: 'Categoría inválida.' }

  try {
    await editarCategoria(sesion, id, { activa })
  } catch (error) {
    return { error: comoError(error) }
  }

  revalidatePath('/productos')
  revalidatePath('/productos/categorias')
  return { ok: activa ? 'Categoría activada.' : 'Categoría desactivada.' }
}
