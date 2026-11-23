'use server'

import { redirect } from 'next/navigation'
import { cambioPasswordSchema, loginSchema } from '@/lib/validation'
import { ApiError } from '@/lib/errors'
import { crearSesion, borrarSesion, requerirSesion } from '@/server/auth'
import { autenticar, cambiarPassword } from '@/server/usuarios'

export type EstadoLogin = {
  error?: string
  email?: string
}

export type EstadoPassword = {
  error?: string
  ok?: string
}

/**
 * Verifica las credenciales y abre la sesion. El mensaje de error es siempre
 * el mismo: no distingue entre email inexistente y contrasena incorrecta.
 */
export async function iniciarSesion(_previo: EstadoLogin, formData: FormData): Promise<EstadoLogin> {
  const crudo = {
    email: formData.get('email'),
    password: formData.get('password'),
  }
  const datos = loginSchema.safeParse(crudo)

  if (!datos.success) {
    return { error: 'Revisá el email y la contraseña.', email: String(crudo.email ?? '') }
  }

  const usuario = await autenticar(datos.data.email, datos.data.password)

  if (!usuario) {
    return { error: 'Email o contraseña incorrectos.', email: datos.data.email }
  }

  await crearSesion(usuario)
  redirect('/')
}

export async function cerrarSesion() {
  await borrarSesion()
  redirect('/login')
}

/** RF-U5: cada usuario cambia su propia contraseña. */
export async function cambiarContrasena(
  _previo: EstadoPassword,
  formData: FormData,
): Promise<EstadoPassword> {
  const sesion = await requerirSesion()
  const datos = cambioPasswordSchema.safeParse(Object.fromEntries(formData))

  if (!datos.success) {
    return { error: datos.error.issues[0]?.message ?? 'Revisá los datos.' }
  }

  try {
    await cambiarPassword(sesion, datos.data.actual, datos.data.nueva)
    return { ok: 'Contraseña actualizada. La próxima vez ingresá con la nueva.' }
  } catch (error) {
    if (error instanceof ApiError) return { error: error.message }
    throw error
  }
}
