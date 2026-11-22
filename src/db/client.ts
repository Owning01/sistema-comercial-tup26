import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import * as schema from './schema'

/**
 * Una sola conexion por proceso. En desarrollo Next recarga los modulos en
 * cada cambio; sin el cache en globalThis se abririan decenas de conexiones.
 */
function crearDb() {
  const url = process.env.DATABASE_URL ?? 'file:./local.db'
  const authToken = process.env.DATABASE_AUTH_TOKEN || undefined
  const cliente = createClient({ url, authToken })
  return drizzle(cliente, { schema })
}

const cache = globalThis as unknown as { db?: ReturnType<typeof crearDb> }

export const db = cache.db ?? crearDb()

if (process.env.NODE_ENV !== 'production') {
  cache.db = db
}

export { schema }
