import type { NextRequest } from 'next/server'
import { json, manejar } from '@/server/api'
import { buscarUsuario } from '@/server/usuarios'

export async function GET(req: NextRequest) {
  return manejar(req, {}, async ({ sesion }) => {
    const usuario = await buscarUsuario(sesion.id)
    return json({
      id: sesion.id,
      nombre: usuario?.nombre ?? sesion.nombre,
      email: usuario?.email ?? '',
      rol: sesion.rol,
    })
  })
}
