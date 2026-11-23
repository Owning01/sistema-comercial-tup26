import type { NextRequest } from 'next/server'
import { fechaDe, idDe, json, manejar, type Contexto } from '@/server/api'
import { obtenerCuentaCorriente } from '@/server/clientes'

export async function GET(req: NextRequest, ctx: Contexto) {
  return manejar(req, ctx, async ({ req, params }) => {
    const id = idDe(params)
    const search = new URL(req.url).searchParams
    return json(
      await obtenerCuentaCorriente(id, {
        desde: fechaDe(search, 'desde'),
        hasta: fechaDe(search, 'hasta', true),
      }),
    )
  })
}
