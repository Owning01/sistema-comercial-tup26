import { cache } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { SignJWT, jwtVerify } from 'jose'

/**
 * La sesion es un JWT firmado que viaja en una cookie httpOnly.
 * El servidor verifica la firma; el navegador no puede leer ni cambiar el
 * contenido. Lo que va adentro se puede leer: nunca guardar secretos.
 */

const COOKIE = 'sesion'
const DURACION = 60 * 60 * 8 // ocho horas

export type Rol = 'admin' | 'vendedor'

export type Sesion = {
  id: number
  nombre: string
  rol: Rol
}

function secreto() {
  const valor = process.env.AUTH_SECRET
  if (!valor) throw new Error('Falta AUTH_SECRET en el entorno')
  return new TextEncoder().encode(valor)
}

export async function crearSesion(usuario: { id: number; nombre: string; rol: Rol }) {
  const token = await new SignJWT({ nombre: usuario.nombre, rol: usuario.rol })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(usuario.id))
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(secreto())

  const store = await cookies()
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: DURACION,
  })
}

/**
 * Una lectura por pedido: si el layout y la pagina preguntan, se verifica una
 * sola vez. `cache` de React memoiza mientras dura el render.
 */
export const leerSesion = cache(async (): Promise<Sesion | null> => {
  const store = await cookies()
  const token = store.get(COOKIE)?.value
  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, secreto(), { algorithms: ['HS256'] })
    const id = Number(payload.sub)
    if (!Number.isInteger(id) || id <= 0) return null
    return {
      id,
      nombre: typeof payload.nombre === 'string' ? payload.nombre : '',
      rol: payload.rol === 'admin' ? 'admin' : 'vendedor',
    }
  } catch {
    return null
  }
})

export async function requerirSesion(): Promise<Sesion> {
  const sesion = await leerSesion()
  if (!sesion) redirect('/login')
  return sesion
}

export async function requerirAdmin(): Promise<Sesion> {
  const sesion = await requerirSesion()
  if (sesion.rol !== 'admin') redirect('/')
  return sesion
}

export async function borrarSesion() {
  const store = await cookies()
  store.delete(COOKIE)
}
