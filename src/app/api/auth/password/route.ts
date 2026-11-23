import type { NextRequest } from 'next/server'
import { passwordApiSchema } from '@/lib/api-schemas'
import { cuerpo, manejar, sinContenido } from '@/server/api'
import { cambiarPassword } from '@/server/usuarios'

export async function PUT(req: NextRequest) {
  return manejar(req, {}, async ({ sesion }) => {
    const { actual, nueva } = await cuerpo(req, passwordApiSchema)
    await cambiarPassword(sesion, actual, nueva)
    return sinContenido()
  })
}
