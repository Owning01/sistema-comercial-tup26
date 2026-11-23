import type { NextRequest } from 'next/server'
import { usuarioApiSchema } from '@/lib/api-schemas'
import { leerPaginacion } from '@/lib/paginacion'
import {
  booleanoDe,
  cuerpo,
  json,
  manejar,
  textoDe,
} from '@/server/api'
import { crearUsuario, listarUsuarios } from '@/server/usuarios'

export async function GET(req: NextRequest) {
  return manejar(req, {}, async ({ req, sesion }) => {
    const params = new URL(req.url).searchParams
    const { page, pageSize } = leerPaginacion(params)
    const resultado = await listarUsuarios(sesion, {
      q: textoDe(params, 'q'),
      activo: booleanoDe(params, 'activo'),
      page,
      pageSize,
    })
    return json(resultado)
  }, { admin: true })
}

export async function POST(req: NextRequest) {
  return manejar(req, {}, async ({ req, sesion }) => {
    const datos = await cuerpo(req, usuarioApiSchema)
    const creado = await crearUsuario(sesion, datos)
    return json(creado, 201)
  }, { admin: true })
}
