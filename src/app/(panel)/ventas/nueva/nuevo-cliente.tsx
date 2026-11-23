'use client'

import { useActionState, useEffect } from 'react'
import { useRestaurarFormulario } from '@/lib/formulario'
import { crearClienteRapido, type EstadoCliente } from '@/server/actions/clientes'

type ClienteCreado = {
  id: number
  nombre: string
  nroDoc: string
  cuentaCorriente: boolean
  limiteCredito: number | null
  saldo: number
}

const inicial: EstadoCliente = {}

const campo =
  'mt-1 w-full rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10'

export function NuevoClienteRapido({
  onCreado,
  onCancelar,
}: {
  onCreado: (cliente: ClienteCreado) => void
  onCancelar: () => void
}) {
  const [estado, enviar, pendiente] = useActionState(crearClienteRapido, inicial)
  const restaurador = useRestaurarFormulario(estado)

  useEffect(() => {
    if (estado.cliente) onCreado(estado.cliente)
  }, [estado, onCreado])

  return (
    <form ref={restaurador.ref} onSubmit={restaurador.onSubmit} action={enviar} className="rounded-lg border border-stone-300 bg-stone-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">Cliente nuevo</p>
        <button
          type="button"
          onClick={onCancelar}
          className="text-xs text-stone-500 underline-offset-4 hover:text-stone-900 hover:underline"
        >
          Cancelar
        </button>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-[110px_1fr]">
        <select name="tipoDoc" defaultValue="DNI" aria-label="Tipo de documento" className={campo}>
          <option value="DNI">DNI</option>
          <option value="CUIT">CUIT</option>
          <option value="CUIL">CUIL</option>
          <option value="PASAPORTE">Pasaporte</option>
        </select>
        <input
          name="nroDoc"
          required
          maxLength={20}
          placeholder="Documento"
          aria-label="Número de documento"
          className={`${campo} font-mono`}
        />
      </div>

      <input
        name="nombre"
        required
        maxLength={120}
        placeholder="Nombre o razón social"
        aria-label="Nombre"
        className={campo}
      />

      <input
        name="telefono"
        maxLength={40}
        placeholder="Teléfono (opcional)"
        aria-label="Teléfono"
        className={campo}
      />

      <label className="mt-3 flex items-center gap-2 text-sm text-stone-700">
        <input
          type="checkbox"
          name="cuentaCorriente"
          defaultChecked
          className="size-4 rounded border-stone-300 accent-stone-900"
        />
        Habilitar cuenta corriente
      </label>

      <input
        name="limiteCredito"
        inputMode="decimal"
        placeholder="Límite de crédito (vacío = sin límite)"
        aria-label="Límite de crédito"
        className={`${campo} tabular-nums`}
      />

      {estado.error ? (
        <p role="alert" className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {estado.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pendiente}
        className="mt-3 rounded-md bg-stone-900 px-3 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-60"
      >
        {pendiente ? 'Creando…' : 'Crear y seleccionar'}
      </button>
    </form>
  )
}
