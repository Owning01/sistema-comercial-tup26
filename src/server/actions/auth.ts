'use server'

import { redirect } from 'next/navigation'
import { loginSchema } from '@/lib/validation'
import { crearSesion, borrarSesion } from '@/server/auth'
import { autenticar } from '@/server/usuarios'

export type EstadoLogin = {
  error?: string
  email?: string
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
