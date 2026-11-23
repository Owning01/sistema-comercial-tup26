import bcrypt from 'bcryptjs'
import { and, asc, eq, sql } from 'drizzle-orm'
import { db } from '@/db/client'
import { usuarios } from '@/db/schema'
import { ApiError } from '@/lib/errors'
import type { EditarUsuarioForm, UsuarioForm } from '@/lib/validation'
import type { Sesion } from './auth'

/**
 * Hash de una contrasena que no existe. Se compara igual cuando el email no
 * esta registrado, para que el tiempo de respuesta no delate que usuarios hay.
 */
const HASH_FALSO = '$2b$10$YHO427GJH50H0cJ8hyOP5e5fTkuasFi0uXVMVCnBGiC8GgIqD9M6m'

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

export async function buscarUsuario(id: number) {
  const [usuario] = await db.select().from(usuarios).where(eq(usuarios.id, id)).limit(1)
  return usuario ?? null
}

export async function listarUsuarios() {
  return db
    .select({
      id: usuarios.id,
      nombre: usuarios.nombre,
      email: usuarios.email,
      rol: usuarios.rol,
      activo: usuarios.activo,
      creadoEn: usuarios.creadoEn,
    })
    .from(usuarios)
    .orderBy(asc(usuarios.nombre))
}

export async function obtenerUsuario(id: number) {
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

  if (!usuario) throw new ApiError(404, 'USUARIO_NO_ENCONTRADO', 'El usuario no existe.')
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

export async function crearUsuario(datos: UsuarioForm) {
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

  return creado
}

export async function editarUsuario(sesion: Sesion, id: number, datos: EditarUsuarioForm) {
  const actual = await obtenerUsuario(id)
  await emailLibre(datos.email, id)

  if (id === sesion.id && (!datos.activo || datos.rol !== 'admin')) {
    throw new ApiError(
      422,
      'PROPIO_ACCESO',
      'No podés quitarte el rol de administrador ni desactivar tu propio usuario.',
    )
  }

  const pierdeAdmin = actual.rol === 'admin' && actual.activo && (datos.rol !== 'admin' || !datos.activo)
  if (pierdeAdmin && (await administradoresActivos()) <= 1) {
    throw new ApiError(
      422,
      'ULTIMO_ADMIN',
      'Tiene que quedar al menos un administrador activo en el sistema.',
    )
  }

  const [actualizado] = await db
    .update(usuarios)
    .set({
      nombre: datos.nombre,
      email: datos.email,
      rol: datos.rol,
      activo: datos.activo,
      ...(datos.password ? { hash: await bcrypt.hash(datos.password, 10) } : {}),
    })
    .where(eq(usuarios.id, id))
    .returning()

  if (!actualizado) {
    throw new ApiError(404, 'USUARIO_NO_ENCONTRADO', 'El usuario no existe.')
  }

  return actualizado
}
