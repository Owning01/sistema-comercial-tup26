'use client'

import { useActionState, useState } from 'react'
import { useRestaurarFormulario } from '@/lib/formulario'
import { registrarMovimientoGlobal, type EstadoMovimiento } from '@/server/actions/productos'

type ProductoOpcion = {
  id: number
  codigo: string
  descripcion: string
  existencia: number
  activo: boolean
}

const inicial: EstadoMovimiento = {}

const campo =
  'mt-1.5 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10'

const etiqueta = 'block text-sm font-medium text-stone-700'

export function FormularioMovimientoGlobal({ productos }: { productos: ProductoOpcion[] }) {
  const [estado, enviar, pendiente] = useActionState(registrarMovimientoGlobal, inicial)
  const restaurador = useRestaurarFormulario(estado)
  const [productoId, setProductoId] = useState(String(productos[0]?.id ?? ''))
  const producto = productos.find((opcion) => String(opcion.id) === productoId)

  return (
    <form ref={restaurador.ref} onSubmit={restaurador.onSubmit} action={enviar} className="max-w-xl space-y-5">
      <div>
        <label htmlFor="productoId" className={etiqueta}>
          Producto
        </label>
        <select
          id="productoId"
          name="productoId"
          value={productoId}
          onChange={(evento) => setProductoId(evento.target.value)}
          className={campo}
        >
          {productos.map((opcion) => (
            <option key={opcion.id} value={opcion.id}>
              {opcion.codigo} · {opcion.descripcion} · stock {opcion.existencia}
              {opcion.activo ? '' : ' · inactivo'}
            </option>
          ))}
        </select>
        {producto ? (
          <p className="mt-1 text-xs text-stone-500">
            Existencia actual: <span className="tabular-nums">{producto.existencia}</span> unidades.
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="tipo" className={etiqueta}>
            Tipo de movimiento
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
          list="motivos-global"
          placeholder="Compra a proveedor"
          className={campo}
        />
        <datalist id="motivos-global">
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

      <div className="border-t border-stone-200 pt-5">
        <button
          type="submit"
          disabled={pendiente}
          className="rounded-md bg-stone-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pendiente ? 'Registrando…' : 'Registrar movimiento'}
        </button>
      </div>
    </form>
  )
}
