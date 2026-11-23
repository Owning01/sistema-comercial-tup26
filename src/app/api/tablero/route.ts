import type { NextRequest } from 'next/server'
import { json, manejar } from '@/server/api'
import { resumenTablero } from '@/server/ventas'

export async function GET(req: NextRequest) {
  return manejar(req, {}, async () => json(await resumenTablero()))
}
