import { randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { and, asc, eq, like, or, sql } from 'drizzle-orm'
import { db } from '@/db/client'
import { usuarios } from '@/db/schema'
import { ApiError } from '@/lib/errors'
import type { Pagina } from '@/lib/paginacion'
import type { EditarUsuarioForm, UsuarioForm } from '@/lib/validation'
import type { Sesion } from './auth'
import { exigirAdmin } from './permisos'

/**
 * Hash de una contraseña que no existe. Se compara igual cuando el email no
 * está registrado, para que el tiempo de respuesta no delate qué usuarios hay.
 */
const HASH_FALSO = '$2b$10$YHO427GJH50H0cJ8hyOP5e5fTkuasFi0uXVMVCnBGiC8GgIqD9M6m'

export type UsuarioPublico = {
  id: number
  nombre: string
  email: string
  rol: 'admin' | 'vendedor'
  activo: boolean
  creadoEn: Date
}

export async function autenticar(email: string, password: string) {
  const [usuario] = await db
    .select()
    .from(usuarios)
    .where(eq(usuarios.email, email))
    .limit(1)

  if (!usuario || !usuario.activo) {
    await bcrypt.compare(password, HASH_FALSO)
    return null
  }

  const coincide = await bcrypt.compare(password, usuario.hash)
  return coincide ? usuario : null
}

/** Lectura interna que usa la sesión: incluye el hash y el estado. */
export async function buscarUsuario(id: number) {
  const [usuario] = await db.select().from(usuarios).where(eq(usuarios.id, id)).limit(1)
  return usuario ?? null
}

export async function listarUsuarios(
  sesion: Sesion,
  filtro: { q?: string; activo?: boolean; page?: number; pageSize?: number } = {},
): Promise<Pagina<UsuarioPublico>> {
  exigirAdmin(sesion)

  const page = filtro.page ?? 1
  const pageSize = filtro.pageSize ?? 100
  const condiciones = []
  const q = filtro.q?.trim()

  if (q) {
    const patron = `%${q}%`
    condiciones.push(or(like(usuarios.nombre, patron), like(usuarios.email, patron)))
  }
  if (filtro.activo !== undefined) condiciones.push(eq(usuarios.activo, filtro.activo))

  const where = condiciones.length ? and(...condiciones) : undefined

  const [conteo] = await db
    .select({ total: sql<number>`count(*)` })
    .from(usuarios)
    .where(where)

  const filas = await db
    .select({
      id: usuarios.id,
      nombre: usuarios.nombre,
      email: usuarios.email,
      rol: usuarios.rol,
      activo: usuarios.activo,
      creadoEn: usuarios.creadoEn,
    })
    .from(usuarios)
    .where(where)
    .orderBy(asc(usuarios.nombre))
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  return { data: filas, page, pageSize, total: Number(conteo.total) }
}

export async function obtenerUsuario(sesion: Sesion, id: number): Promise<UsuarioPublico> {
  exigirAdmin(sesion)

  const [usuario] = await db
    .select({
      id: usuarios.id,
      nombre: usuarios.nombre,
      email: usuarios.email,
      rol: usuarios.rol,
      activo: usuarios.activo,
      creadoEn: usuarios.creadoEn,
    })
    .from(usuarios)
    .where(eq(usuarios.id, id))
    .limit(1)

  if (!usuario) throw new ApiError(404, 'NO_ENCONTRADO', 'El usuario no existe.')
  return usuario
}

async function emailLibre(email: string, exceptoId?: number) {
  const [existente] = await db
    .select({ id: usuarios.id })
    .from(usuarios)
    .where(eq(usuarios.email, email))
    .limit(1)

  if (existente && existente.id !== exceptoId) {
    throw new ApiError(409, 'EMAIL_DUPLICADO', `Ya existe un usuario con el email ${email}.`)
  }
}

async function administradoresActivos() {
  const [fila] = await db
    .select({ n: sql<number>`count(*)` })
    .from(usuarios)
    .where(and(eq(usuarios.rol, 'admin'), eq(usuarios.activo, true)))

  return Number(fila.n)
}

export async function crearUsuario(sesion: Sesion, datos: UsuarioForm): Promise<UsuarioPublico> {
  exigirAdmin(sesion)
  await emailLibre(datos.email)

  const [creado] = await db
    .insert(usuarios)
    .values({
      nombre: datos.nombre,
      email: datos.email,
      hash: await bcrypt.hash(datos.password, 10),
      rol: datos.rol,
      activo: true,
    })
    .returning()

  return {
    id: creado.id,
    nombre: creado.nombre,
    email: creado.email,
    rol: creado.rol,
    activo: creado.activo,
    creadoEn: creado.creadoEn,
  }
}

type CambiosUsuario = Partial<{
  nombre: string
  email: string
  rol: 'admin' | 'vendedor'
  activo: boolean
  password: string | null
}>

export async function editarUsuario(
  sesion: Sesion,
  id: number,
  datos: EditarUsuarioForm | CambiosUsuario,
): Promise<UsuarioPublico> {
  exigirAdmin(sesion)

  const [actual] = await db.select().from(usuarios).where(eq(usuarios.id, id)).limit(1)
  if (!actual) throw new ApiError(404, 'NO_ENCONTRADO', 'El usuario no existe.')

  const siguiente = {
    nombre: datos.nombre ?? actual.nombre,
    email: datos.email ?? actual.email,
    rol: datos.rol ?? actual.rol,
    activo: datos.activo ?? actual.activo,
    password: datos.password ?? null,
  }

  if (id === sesion.id && (!siguiente.activo || siguiente.rol !== 'admin')) {
    throw new ApiError(
      422,
      'OPERACION_SOBRE_SI_MISMO',
      'No podés quitarte el rol de administrador ni desactivar tu propio usuario.',
    )
  }

  if (siguiente.email !== actual.email) await emailLibre(siguiente.email, id)

  const pierdeAdmin =
    actual.rol === 'admin' && actual.activo && (siguiente.rol !== 'admin' || !siguiente.activo)
  if (pierdeAdmin && (await administradoresActivos()) <= 1) {
    throw new ApiError(
      422,
      'OPERACION_SOBRE_SI_MISMO',
      'Tiene que quedar al menos un administrador activo en el sistema.',
    )
  }

  const [actualizado] = await db
    .update(usuarios)
    .set({
      nombre: siguiente.nombre,
      email: siguiente.email,
      rol: siguiente.rol,
      activo: siguiente.activo,
      ...(siguiente.password ? { hash: await bcrypt.hash(siguiente.password, 10) } : {}),
    })
    .where(eq(usuarios.id, id))
    .returning()

  return {
    id: actualizado.id,
    nombre: actualizado.nombre,
    email: actualizado.email,
    rol: actualizado.rol,
    activo: actualizado.activo,
    creadoEn: actualizado.creadoEn,
  }
}

export async function resetPassword(sesion: Sesion, id: number) {
  exigirAdmin(sesion)

  const [actual] = await db.select({ id: usuarios.id }).from(usuarios).where(eq(usuarios.id, id)).limit(1)
  if (!actual) throw new ApiError(404, 'NO_ENCONTRADO', 'El usuario no existe.')

  const passwordTemporal = randomBytes(9).toString('base64url')

  await db
    .update(usuarios)
    .set({ hash: await bcrypt.hash(passwordTemporal, 10) })
    .where(eq(usuarios.id, id))

  return { passwordTemporal }
}

/** RF-U5: cada usuario cambia su propia contraseña. */
export async function cambiarPassword(sesion: Sesion, actual: string, nueva: string) {
  const usuario = await buscarUsuario(sesion.id)
  if (!usuario) throw new ApiError(401, 'NO_AUTENTICADO', 'Iniciá sesión para continuar.')

  const coincide = await bcrypt.compare(actual, usuario.hash)
  if (!coincide) {
    throw new ApiError(
      422,
      'CONTRASENA_ACTUAL_INCORRECTA',
      'La contraseña actual no coincide.',
    )
  }

  await db
    .update(usuarios)
    .set({ hash: await bcrypt.hash(nueva, 10) })
    .where(eq(usuarios.id, sesion.id))
}
