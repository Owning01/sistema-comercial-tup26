import { and, asc, eq, sql } from 'drizzle-orm'
import { db } from '@/db/client'
import { categorias, productos } from '@/db/schema'
import { ApiError } from '@/lib/errors'
import type { Sesion } from './auth'
import { exigirAdmin } from './permisos'

/** Categorías del catálogo. Solo el administrador crea y edita (RF-P7). */

export type CategoriaPublica = {
  id: number
  nombre: string
  activa: boolean
}

export async function listarCategorias(): Promise<CategoriaPublica[]> {
  return db
    .select({ id: categorias.id, nombre: categorias.nombre, activa: categorias.activa })
    .from(categorias)
    .where(eq(categorias.activa, true))
    .orderBy(asc(categorias.nombre))
}

/** Vista de administración: incluye las inactivas para poder reactivarlas. */
export async function listarTodasCategorias(sesion: Sesion): Promise<CategoriaPublica[]> {
  exigirAdmin(sesion)
  return db
    .select({ id: categorias.id, nombre: categorias.nombre, activa: categorias.activa })
    .from(categorias)
    .orderBy(asc(categorias.nombre))
}

export async function crearCategoria(sesion: Sesion, nombre: string) {
  exigirAdmin(sesion)

  const [existente] = await db
    .select({ id: categorias.id })
    .from(categorias)
    .where(eq(categorias.nombre, nombre))
    .limit(1)

  if (existente) {
    throw new ApiError(409, 'NOMBRE_DUPLICADO', `Ya existe una categoría llamada ${nombre}.`)
  }

  const [creada] = await db.insert(categorias).values({ nombre }).returning()
  return creada
}

export async function editarCategoria(
  sesion: Sesion,
  id: number,
  datos: { nombre?: string; activa?: boolean },
) {
  exigirAdmin(sesion)

  const [actual] = await db.select().from(categorias).where(eq(categorias.id, id)).limit(1)
  if (!actual) throw new ApiError(404, 'NO_ENCONTRADO', 'La categoría no existe.')

  if (datos.nombre && datos.nombre !== actual.nombre) {
    const [existente] = await db
      .select({ id: categorias.id })
      .from(categorias)
      .where(eq(categorias.nombre, datos.nombre))
      .limit(1)

    if (existente && existente.id !== id) {
      throw new ApiError(409, 'NOMBRE_DUPLICADO', `Ya existe una categoría llamada ${datos.nombre}.`)
    }
  }

  if (datos.activa === false && actual.activa) {
    const [enUso] = await db
      .select({ n: sql<number>`count(*)` })
      .from(productos)
      .where(and(eq(productos.categoriaId, id), eq(productos.activo, true)))

    if (Number(enUso.n) > 0) {
      throw new ApiError(
        409,
        'CATEGORIA_EN_USO',
        'No se puede desactivar una categoría con productos activos.',
      )
    }
  }

  const [actualizada] = await db
    .update(categorias)
    .set({
      ...(datos.nombre ? { nombre: datos.nombre } : {}),
      ...(datos.activa === undefined ? {} : { activa: datos.activa }),
    })
    .where(eq(categorias.id, id))
    .returning()

  return actualizada
}
