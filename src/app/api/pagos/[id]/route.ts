import type { NextRequest } from 'next/server'
import { idDe, json, manejar, type Contexto } from '@/server/api'
import { obtenerPago } from '@/server/clientes'

export async function GET(req: NextRequest, ctx: Contexto) {
  return manejar(req, ctx, async ({ params }) => {
    const id = idDe(params)
    return json(await obtenerPago(id))
  })
}
