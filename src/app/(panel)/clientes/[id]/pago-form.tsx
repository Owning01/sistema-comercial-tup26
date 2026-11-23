'use client'

import { useActionState, useEffect } from 'react'
import { formatearPesos } from '@/lib/dinero'
import { useRestaurarFormulario } from '@/lib/formulario'
import { registrarPagoCliente, type EstadoCliente } from '@/server/actions/clientes'

const inicial: EstadoCliente = {}

const campo =
  'mt-1.5 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10'

const etiqueta = 'block text-sm font-medium text-stone-700'

export function FormularioPago({ clienteId, saldo }: { clienteId: number; saldo: number }) {
  const [estado, enviar, pendiente] = useActionState(registrarPagoCliente, inicial)
  const restaurador = useRestaurarFormulario(estado)

  useEffect(() => {
    if (estado.ok) restaurador.ref.current?.reset()
  }, [estado, restaurador.ref])

  if (saldo <= 0) {
    return (
      <div className="rounded-lg border border-stone-200 bg-stone-50 px-4 py-5">
        <p className="text-sm font-medium">Sin deuda pendiente</p>
        <p className="mt-1 text-sm text-stone-600">
          Cuando se registre una venta en cuenta corriente, el saldo aparece acá.
        </p>
      </div>
    )
  }

  return (
    <form ref={restaurador.ref} onSubmit={restaurador.onSubmit} action={enviar} className="space-y-4">
      <input type="hidden" name="clienteId" value={clienteId} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="importe" className={etiqueta}>
            Importe
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-stone-500">
              $
            </span>
            <input
              id="importe"
              name="importe"
              required
              inputMode="decimal"
              autoComplete="off"
              placeholder="0,00"
              className={`${campo} pl-7 tabular-nums`}
            />
          </div>
          <p className="mt-1 text-xs text-stone-500">Saldo actual: {formatearPesos(saldo)}</p>
        </div>

        <div>
          <label htmlFor="medio" className={etiqueta}>
            Medio
          </label>
          <select id="medio" name="medio" defaultValue="efectivo" className={campo}>
            <option value="efectivo">Efectivo</option>
            <option value="transferencia">Transferencia</option>
            <option value="tarjeta">Tarjeta</option>
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="observacion" className={etiqueta}>
          Observación <span className="font-normal text-stone-400">(opcional)</span>
        </label>
        <input
          id="observacion"
          name="observacion"
          maxLength={200}
          autoComplete="off"
          placeholder="Pago parcial acordado"
          className={campo}
        />
      </div>

      {estado.error ? (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {estado.error}
        </p>
      ) : null}

      {estado.ok ? (
        <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {estado.ok}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pendiente}
        className="rounded-md bg-stone-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pendiente ? 'Registrando…' : 'Registrar pago'}
      </button>
    </form>
  )
}
