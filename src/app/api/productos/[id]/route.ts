import type { NextRequest } from 'next/server'
import { productoPatchSchema } from '@/lib/api-schemas'
import { cuerpo, idDe, json, manejar, type Contexto } from '@/server/api'
import { editarProducto, obtenerProducto } from '@/server/productos'

export async function GET(req: NextRequest, ctx: Contexto) {
  return manejar(req, ctx, async ({ params }) => {
    const id = idDe(params)
    return json(await obtenerProducto(id))
  })
}

export async function PATCH(req: NextRequest, ctx: Contexto) {
  return manejar(req, ctx, async ({ req, sesion, params }) => {
    const id = idDe(params)
    const datos = await cuerpo(req, productoPatchSchema)
    const actualizado = await editarProducto(sesion, id, datos)
    return json(actualizado)
  }, { admin: true })
}
