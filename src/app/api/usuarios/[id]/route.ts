import type { NextRequest } from 'next/server'
import { usuarioPatchSchema } from '@/lib/api-schemas'
import { cuerpo, idDe, json, manejar, type Contexto } from '@/server/api'
import { editarUsuario } from '@/server/usuarios'

export async function PATCH(req: NextRequest, ctx: Contexto) {
  return manejar(req, ctx, async ({ req, sesion, params }) => {
    const id = idDe(params)
    const datos = await cuerpo(req, usuarioPatchSchema)
    const actualizado = await editarUsuario(sesion, id, datos)
    return json(actualizado)
  }, { admin: true })
}
