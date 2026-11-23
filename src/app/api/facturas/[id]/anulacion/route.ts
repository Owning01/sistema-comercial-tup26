import type { NextRequest } from 'next/server'
import { anulacionApiSchema } from '@/lib/api-schemas'
import { cuerpo, idDe, json, manejar, type Contexto } from '@/server/api'
import { anularVenta } from '@/server/ventas'

export async function POST(req: NextRequest, ctx: Contexto) {
  return manejar(req, ctx, async ({ req, sesion, params }) => {
    const id = idDe(params)
    const { motivo } = await cuerpo(req, anulacionApiSchema)
    return json(await anularVenta(sesion, id, motivo))
  }, { admin: true })
}
