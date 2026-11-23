'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { ApiError } from '@/lib/errors'
import { editarUsuarioSchema, usuarioSchema } from '@/lib/validation'
import { requerirAdmin } from '@/server/auth'
import { crearUsuario, editarUsuario } from '@/server/usuarios'

export type EstadoUsuario = {
  error?: string
}

function primerError(issues: { message: string }[]) {
  return issues[0]?.message ?? 'Revisá los datos.'
}

function comoError(error: unknown): string {
  if (error instanceof ApiError) return error.message
  throw error
}

export async function guardarUsuario(
  _previo: EstadoUsuario,
  formData: FormData,
): Promise<EstadoUsuario> {
  await requerirAdmin()
  const datos = usuarioSchema.safeParse(Object.fromEntries(formData))

  if (!datos.success) return { error: primerError(datos.error.issues) }

  try {
    await crearUsuario(datos.data)
  } catch (error) {
    return { error: comoError(error) }
  }

  revalidatePath('/usuarios')
  redirect('/usuarios')
}

export async function actualizarUsuario(
  _previo: EstadoUsuario,
  formData: FormData,
): Promise<EstadoUsuario> {
  const sesion = await requerirAdmin()
  const id = Number(formData.get('id'))

  if (!Number.isInteger(id) || id <= 0) return { error: 'Usuario inválido.' }

  const datos = editarUsuarioSchema.safeParse(Object.fromEntries(formData))

  if (!datos.success) return { error: primerError(datos.error.issues) }

  try {
    await editarUsuario(sesion, id, datos.data)
  } catch (error) {
    return { error: comoError(error) }
  }

  revalidatePath('/usuarios')
  revalidatePath(`/usuarios/${id}`)
  redirect('/usuarios')
}
