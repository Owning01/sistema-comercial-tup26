/** Fechas del sistema, siempre en horario de Argentina. */

const formato = new Intl.DateTimeFormat('es-AR', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'America/Argentina/Buenos_Aires',
})

export function formatearFecha(fecha: Date): string {
  return formato.format(fecha)
}
