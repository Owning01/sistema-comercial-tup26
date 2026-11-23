/** El dinero se guarda en centavos y se muestra en pesos. Nunca al revés. */

export function formatearPesos(centavos: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
  }).format(centavos / 100)
}

export function formatearNumero(puntoVenta: number, numero: number): string {
  return `${String(puntoVenta).padStart(4, '0')}-${String(numero).padStart(8, '0')}`
}

/**
 * Convierte lo que escribe el usuario en centavos. Acepta "4800", "4800,50",
 * "4800.50" y "1.234,56" (formato argentino con miles).
 */
export function aCentavos(texto: string): number | null {
  let limpio = texto.trim().replace(/[\s$]/g, '')
  if (!/^\d[\d.,]*$/.test(limpio)) return null

  if (limpio.includes(',')) {
    // Con coma decimal, los puntos son separadores de miles.
    limpio = limpio.replace(/\./g, '').replace(',', '.')
  } else if (/^\d{1,3}(\.\d{3})+$/.test(limpio)) {
    // "1.200" o "12.000": puntos de miles, sin decimales.
    limpio = limpio.replace(/\./g, '')
  } else if ((limpio.match(/\./g) ?? []).length > 1) {
    limpio = limpio.replace(/\./g, '')
  }

  if (!/^\d+(\.\d{1,2})?$/.test(limpio)) return null
  const valor = Math.round(Number(limpio) * 100)
  return Number.isFinite(valor) ? valor : null
}

/** El camino inverso: centavos a un texto editable en pesos. */
export function aPesosEditables(centavos: number): string {
  return (centavos / 100).toFixed(2).replace('.', ',')
}
