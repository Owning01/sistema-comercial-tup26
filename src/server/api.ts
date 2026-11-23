import { NextResponse, type NextRequest } from 'next/server'
import { ZodError, type ZodType } from 'zod'
import { ApiError } from '@/lib/errors'
import { leerSesion, type Sesion } from './auth'
import { exigirAdmin } from './permisos'

/**
 * Adaptador común de las rutas: exige sesión, resuelve los parámetros, lee el
 * JSON y traduce cualquier error al formato de la sección 11.1. Las rutas no
 * deciden reglas: llaman a un servicio y responden.
 */

export type Contexto = { params?: Promise<Record<string, string>> }

type Args = {
  req: NextRequest
  sesion: Sesion
  params: Record<string, string>
}

type ArgsPublicos = { req: NextRequest }

export async function manejar(
  req: NextRequest,
  ctx: Contexto,
  fn: (args: Args) => Promise<Response>,
  opciones: { admin?: boolean } = {},
): Promise<Response> {
  try {
    const sesion = await leerSesion()
    if (!sesion) {
      throw new ApiError(401, 'NO_AUTENTICADO', 'Iniciá sesión para continuar.')
    }
    if (opciones.admin) exigirAdmin(sesion)
    const params = ctx.params ? await ctx.params : {}
    return await fn({ req, sesion, params })
  } catch (error) {
    return respuestaError(error)
  }
}

export async function manejarPublico(
  req: NextRequest,
  fn: (args: ArgsPublicos) => Promise<Response>,
): Promise<Response> {
  try {
    return await fn({ req })
  } catch (error) {
    return respuestaError(error)
  }
}

export function json(datos: unknown, status = 200): Response {
  return NextResponse.json(datos, { status })
}

export function sinContenido(): Response {
  return new NextResponse(null, { status: 204 })
}

export async function cuerpo<T>(req: NextRequest, schema: ZodType<T>): Promise<T> {
  let crudo: unknown
  try {
    crudo = await req.json()
  } catch {
    throw new ApiError(400, 'JSON_INVALIDO', 'El cuerpo no es JSON válido.')
  }

  const datos = schema.safeParse(crudo)
  if (!datos.success) {
    throw new ApiError(422, 'VALIDACION', 'Hay campos con errores.', detallesZod(datos.error))
  }
  return datos.data
}

export function validar<T>(schema: ZodType<T>, datos: unknown): T {
  const resultado = schema.safeParse(datos)
  if (!resultado.success) {
    throw new ApiError(422, 'VALIDACION', 'Hay campos con errores.', detallesZod(resultado.error))
  }
  return resultado.data
}

export function idDe(params: Record<string, string>): number {
  const id = Number(params.id)
  if (!Number.isInteger(id) || id <= 0) {
    throw new ApiError(404, 'NO_ENCONTRADO', 'El recurso no existe.')
  }
  return id
}

export function textoDe(params: URLSearchParams, nombre: string): string | undefined {
  const valor = params.get(nombre)?.trim()
  return valor ? valor : undefined
}

export function numeroDe(params: URLSearchParams, nombre: string): number | undefined {
  const valor = params.get(nombre)
  if (valor === null || valor === '') return undefined
  const numero = Number(valor)
  if (!Number.isInteger(numero) || numero <= 0) return undefined
  return numero
}

export function booleanoDe(params: URLSearchParams, nombre: string): boolean | undefined {
  const valor = params.get(nombre)
  if (valor === 'true') return true
  if (valor === 'false') return false
  return undefined
}

const FORMATO_DIA = /^\d{4}-\d{2}-\d{2}$/

/** `AAAA-MM-DD` se interpreta en hora de Argentina (UTC-3). */
export function fechaDe(params: URLSearchParams, nombre: string, fin = false): Date | undefined {
  const valor = params.get(nombre)?.trim()
  if (!valor) return undefined
  if (!FORMATO_DIA.test(valor)) {
    throw new ApiError(422, 'VALIDACION', 'Hay campos con errores.', [
      { campo: nombre, mensaje: 'La fecha tiene que tener el formato AAAA-MM-DD.' },
    ])
  }
  return new Date(`${valor}T${fin ? '23:59:59.999' : '00:00:00.000'}-03:00`)
}

function detallesZod(error: ZodError) {
  return error.issues.map((issue) => ({
    campo: issue.path.join('.') || 'cuerpo',
    mensaje: issue.message,
  }))
}

function respuestaError(error: unknown): Response {
  if (error instanceof ApiError) {
    return json(
      {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details === undefined ? {} : { details: error.details }),
        },
      },
      error.status,
    )
  }

  if (error instanceof ZodError) {
    return json(
      { error: { code: 'VALIDACION', message: 'Hay campos con errores.', details: detallesZod(error) } },
      422,
    )
  }

  console.error('Error no controlado en la API:', error)
  return json(
    { error: { code: 'ERROR_INTERNO', message: 'Ocurrió un error inesperado.' } },
    500,
  )
}
