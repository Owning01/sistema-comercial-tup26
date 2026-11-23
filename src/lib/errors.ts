/**
 * Error con forma de respuesta. El adaptador lo traduce a JSON:
 * status, codigo y mensaje. El servicio nunca arma HTTP.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}
