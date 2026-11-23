import type { NextRequest } from 'next/server'
import { productoApiSchema } from '@/lib/api-schemas'
import { leerPaginacion } from '@/lib/paginacion'
import { booleanoDe, cuerpo, json, manejar, numeroDe, textoDe } from '@/server/api'
import { crearProducto, listarProductos } from '@/server/productos'

export async function GET(req: NextRequest) {
  return manejar(req, {}, async ({ req, sesion }) => {
    const params = new URL(req.url).searchParams
    const { page, pageSize } = leerPaginacion(params)

    let activo: boolean | 'todos' = true
    if (params.get('activo') === 'todos' && sesion.rol === 'admin') activo = 'todos'
    else if (params.get('activo') === 'false' && sesion.rol === 'admin') activo = false

    const resultado = await listarProductos({
      q: textoDe(params, 'q'),
      categoriaId: numeroDe(params, 'categoriaId'),
      bajoMinimo: booleanoDe(params, 'bajoMinimo'),
      activo,
      page,
      pageSize,
    })

    return json(resultado)
  })
}

export async function POST(req: NextRequest) {
  return manejar(req, {}, async ({ req, sesion }) => {
    const datos = await cuerpo(req, productoApiSchema)
    const creado = await crearProducto(sesion, {
      codigo: datos.codigo,
      descripcion: datos.descripcion,
      categoriaId: datos.categoriaId ?? null,
      precio: datos.precio,
      stockMinimo: datos.stockMinimo,
      stockInicial: datos.stockInicial ?? 0,
      activo: datos.activo ?? true,
    })
    return json(creado, 201)
  }, { admin: true })
}
