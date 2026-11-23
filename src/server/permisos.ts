import { ApiError } from '@/lib/errors'
import type { Sesion } from './auth'

/**
 * Los servicios verifican el rol por su cuenta. El adaptador (API o Server
 * Action) puede adelantarlo, pero el permiso se decide acá.
 */
export function exigirAdmin(sesion: Sesion): void {
  if (sesion.rol !== 'admin') {
    throw new ApiError(403, 'SIN_PERMISO', 'No tenés permiso para esta operación.')
  }
}
