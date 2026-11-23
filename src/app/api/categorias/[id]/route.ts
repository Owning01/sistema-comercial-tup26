import type { NextRequest } from 'next/server'
import { categoriaPatchSchema } from '@/lib/api-schemas'
import { cuerpo, idDe, json, manejar, type Contexto } from '@/server/api'
import { editarCategoria } from '@/server/categorias'

export async function PATCH(req: NextRequest, ctx: Contexto) {
  return manejar(req, ctx, async ({ req, sesion, params }) => {
    const id = idDe(params)
    const datos = await cuerpo(req, categoriaPatchSchema)
    const actualizada = await editarCategoria(sesion, id, datos)
    return json(actualizada)
  }, { admin: true })
}
