'use client'

import { useEffect, useRef } from 'react'

/**
 * React 19 limpia los campos no controlados cuando termina una Server Action.
 * Este hook guarda lo escrito antes de enviar y lo vuelve a poner si la accion
 * devolvio un error, para que el usuario corrija sin cargar todo de nuevo.
 */
export function useRestaurarFormulario(estado: { error?: string }) {
  const ref = useRef<HTMLFormElement>(null)
  const valores = useRef<Record<string, string | boolean>>({})

  function guardar() {
    const formulario = ref.current
    if (!formulario) return

    const datos: Record<string, string | boolean> = {}
    for (const [nombre, valor] of new FormData(formulario).entries()) {
      if (typeof valor === 'string') datos[nombre] = valor
    }

    // Los checkbox desmarcados no viajan en el FormData.
    for (const elemento of formulario.elements) {
      if (elemento instanceof HTMLInputElement && elemento.type === 'checkbox') {
        datos[elemento.name] = elemento.checked
      }
    }

    valores.current = datos
  }

  useEffect(() => {
    if (!estado.error || !ref.current) return

    const formulario = ref.current
    for (const [nombre, valor] of Object.entries(valores.current)) {
      const elemento = formulario.elements.namedItem(nombre)

      if (elemento instanceof HTMLInputElement) {
        if (elemento.type === 'checkbox') elemento.checked = Boolean(valor)
        else if (typeof valor === 'string') elemento.value = valor
      } else if (elemento instanceof HTMLSelectElement && typeof valor === 'string') {
        elemento.value = valor
      } else if (elemento instanceof HTMLTextAreaElement && typeof valor === 'string') {
        elemento.value = valor
      }
    }
  }, [estado])

  return { ref, onSubmit: guardar }
}
