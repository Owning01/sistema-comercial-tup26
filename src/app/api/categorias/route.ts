import type { NextRequest } from 'next/server'
import { categoriaApiSchema } from '@/lib/api-schemas'
import { cuerpo, json, manejar } from '@/server/api'
import { crearCategoria, listarCategorias } from '@/server/categorias'

export async function GET(req: NextRequest) {
  return manejar(req, {}, async () => json(await listarCategorias()))
}

export async function POST(req: NextRequest) {
  return manejar(req, {}, async ({ req, sesion }) => {
    const { nombre } = await cuerpo(req, categoriaApiSchema)
    const creada = await crearCategoria(sesion, nombre)
    return json(creada, 201)
  }, { admin: true })
}
