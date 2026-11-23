'use client'

import { useActionState, useEffect, useRef } from 'react'
import { registrarMovimiento, type EstadoMovimiento } from '@/server/actions/productos'

const inicial: EstadoMovimiento = {}

const campo =
  'mt-1.5 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10'

const etiqueta = 'block text-sm font-medium text-stone-700'

export function FormularioMovimiento({
  productoId,
  existencia,
}: {
  productoId: number
  existencia: number
}) {
  const [estado, enviar, pendiente] = useActionState(registrarMovimiento, inicial)
  const formulario = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (estado.ok) formulario.current?.reset()
  }, [estado])

  return (
    <form ref={formulario} action={enviar} className="space-y-4">
      <input type="hidden" name="productoId" value={productoId} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="tipo" className={etiqueta}>
            Movimiento
          </label>
          <select id="tipo" name="tipo" defaultValue="ingreso" className={campo}>
            <option value="ingreso">Entrada</option>
            <option value="egreso">Salida</option>
          </select>
        </div>

        <div>
          <label htmlFor="cantidad" className={etiqueta}>
            Cantidad
          </label>
          <input
            id="cantidad"
            name="cantidad"
            required
            inputMode="numeric"
            autoComplete="off"
            placeholder="1"
            className={`${campo} tabular-nums`}
          />
        </div>
      </div>

      <div>
        <label htmlFor="motivo" className={etiqueta}>
          Motivo
        </label>
        <input
          id="motivo"
          name="motivo"
          required
          maxLength={120}
          autoComplete="off"
          list="motivos"
          placeholder="Compra a proveedor"
          className={campo}
        />
        <datalist id="motivos">
          <option value="Compra a proveedor" />
          <option value="Rotura" />
          <option value="Vencimiento" />
          <option value="Recuento" />
          <option value="Devolución de cliente" />
        </datalist>
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
          placeholder="Remito 0001-00001234"
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

      <div className="flex items-center justify-between gap-3">
        <button
          type="submit"
          disabled={pendiente}
          className="rounded-md bg-stone-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pendiente ? 'Registrando…' : 'Registrar movimiento'}
        </button>
        <p className="text-xs text-stone-500">
          Existencia actual: <span className="tabular-nums">{existencia}</span>
        </p>
      </div>
    </form>
  )
}
