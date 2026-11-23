import type { NextRequest } from 'next/server'
import { loginApiSchema } from '@/lib/api-schemas'
import { ApiError } from '@/lib/errors'
import { crearSesion } from '@/server/auth'
import { autenticar } from '@/server/usuarios'
import { cuerpo, json, manejarPublico } from '@/server/api'

export async function POST(req: NextRequest) {
  return manejarPublico(req, async () => {
    const { email, password } = await cuerpo(req, loginApiSchema)
    const usuario = await autenticar(email, password)

    if (!usuario) {
      throw new ApiError(401, 'CREDENCIALES_INVALIDAS', 'Email o contraseña incorrectos.')
    }

    await crearSesion(usuario)

    return json({
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      rol: usuario.rol,
    })
  })
}
