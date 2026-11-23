'use client'

import { useActionState } from 'react'
import { aPesosEditables } from '@/lib/dinero'
import { useRestaurarFormulario } from '@/lib/formulario'
import type { EstadoCliente } from '@/server/actions/clientes'

type ClienteEditable = {
  id: number
  tipoDoc: string
  nroDoc: string
  nombre: string
  domicilio: string | null
  telefono: string | null
  email: string | null
  cuentaCorriente: boolean
  limiteCredito: number | null
  activo: boolean
}

type Props = {
  accion: (previo: EstadoCliente, formData: FormData) => Promise<EstadoCliente>
  cliente?: ClienteEditable
}

const inicial: EstadoCliente = {}

const campo =
  'mt-1.5 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10'

const etiqueta = 'block text-sm font-medium text-stone-700'

const tiposDoc = ['DNI', 'CUIT', 'CUIL', 'PASAPORTE']

export function FormularioCliente({ accion, cliente }: Props) {
  const [estado, enviar, pendiente] = useActionState(accion, inicial)
  const restaurador = useRestaurarFormulario(estado)
  const editando = Boolean(cliente)

  return (
    <form ref={restaurador.ref} onSubmit={restaurador.onSubmit} action={enviar} className="max-w-2xl space-y-5">
      {cliente ? <input type="hidden" name="id" value={cliente.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-[150px_1fr]">
        <div>
          <label htmlFor="tipoDoc" className={etiqueta}>
            Documento
          </label>
          <select id="tipoDoc" name="tipoDoc" defaultValue={cliente?.tipoDoc ?? 'DNI'} className={campo}>
            {tiposDoc.map((tipo) => (
              <option key={tipo} value={tipo}>
                {tipo}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="nroDoc" className={etiqueta}>
            Número
          </label>
          <input
            id="nroDoc"
            name="nroDoc"
            required
            maxLength={20}
            autoComplete="off"
            defaultValue={cliente?.nroDoc}
            placeholder="30123456"
            className={`${campo} font-mono`}
          />
        </div>
      </div>

      <div>
        <label htmlFor="nombre" className={etiqueta}>
          Nombre o razón social
        </label>
        <input
          id="nombre"
          name="nombre"
          required
          maxLength={120}
          autoComplete="off"
          defaultValue={cliente?.nombre}
          placeholder="Almacén Don Pedro"
          className={campo}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="telefono" className={etiqueta}>
            Teléfono <span className="font-normal text-stone-400">(opcional)</span>
          </label>
          <input
            id="telefono"
            name="telefono"
            maxLength={40}
            autoComplete="off"
            defaultValue={cliente?.telefono ?? ''}
            placeholder="342 555 1234"
            className={campo}
          />
        </div>

        <div>
          <label htmlFor="email" className={etiqueta}>
            Email <span className="font-normal text-stone-400">(opcional)</span>
          </label>
          <input
            id="email"
            name="email"
            type="email"
            maxLength={120}
            autoComplete="off"
            defaultValue={cliente?.email ?? ''}
            placeholder="cliente@correo.test"
            className={campo}
          />
        </div>
      </div>

      <div>
        <label htmlFor="domicilio" className={etiqueta}>
          Domicilio <span className="font-normal text-stone-400">(opcional)</span>
        </label>
        <input
          id="domicilio"
          name="domicilio"
          maxLength={200}
          autoComplete="off"
          defaultValue={cliente?.domicilio ?? ''}
          placeholder="San Martín 1234"
          className={campo}
        />
      </div>

      <fieldset className="rounded-lg border border-stone-200 p-4">
        <legend className="px-1 text-sm font-medium text-stone-700">Cuenta corriente</legend>
        <label className="flex items-center gap-2 text-sm text-stone-700">
          <input
            type="checkbox"
            name="cuentaCorriente"
            defaultChecked={cliente ? cliente.cuentaCorriente : true}
            className="size-4 rounded border-stone-300 accent-stone-900"
          />
          Habilitada para vender a cuenta
        </label>

        <div className="mt-4 max-w-xs">
          <label htmlFor="limiteCredito" className={etiqueta}>
            Límite de crédito
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-stone-500">
              $
            </span>
            <input
              id="limiteCredito"
              name="limiteCredito"
              inputMode="decimal"
              autoComplete="off"
              defaultValue={cliente?.limiteCredito ? aPesosEditables(cliente.limiteCredito) : ''}
              placeholder="Sin límite"
              className={`${campo} pl-7 tabular-nums`}
            />
          </div>
          <p className="mt-1 text-xs text-stone-500">Vacío significa sin límite.</p>
        </div>
      </fieldset>

      {editando ? (
        <label className="flex items-center gap-2 text-sm text-stone-700">
          <input
            type="checkbox"
            name="activo"
            defaultChecked={cliente?.activo}
            className="size-4 rounded border-stone-300 accent-stone-900"
          />
          Cliente activo
        </label>
      ) : null}

      {estado.error ? (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {estado.error}
        </p>
      ) : null}

      <div className="border-t border-stone-200 pt-5">
        <button
          type="submit"
          disabled={pendiente}
          className="whitespace-nowrap rounded-md bg-stone-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pendiente ? 'Guardando…' : editando ? 'Guardar cambios' : 'Crear cliente'}
        </button>
      </div>
    </form>
  )
}
