import type { NextRequest } from 'next/server'
import { pagoApiSchema } from '@/lib/api-schemas'
import { cuerpo, idDe, json, manejar, type Contexto } from '@/server/api'
import { registrarPago } from '@/server/clientes'

export async function POST(req: NextRequest, ctx: Contexto) {
  return manejar(req, ctx, async ({ req, sesion, params }) => {
    const id = idDe(params)
    const datos = await cuerpo(req, pagoApiSchema)
    const pago = await registrarPago(sesion, id, {
      importe: datos.importe,
      medio: datos.medio,
      observacion: datos.observacion ?? null,
    })
    return json(pago, 201)
  })
}
