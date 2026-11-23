import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { db } from '@/db/client'
import { usuarios } from '@/db/schema'

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
