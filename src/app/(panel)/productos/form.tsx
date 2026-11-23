'use client'

import { useActionState } from 'react'
import { aPesosEditables } from '@/lib/dinero'
import type { EstadoProducto } from '@/server/actions/productos'

type Categoria = { id: number; nombre: string }

type ProductoEditable = {
  id: number
  codigo: string
  descripcion: string
  categoriaId: number | null
  precio: number
  stockMinimo: number
  activo: boolean
}

type Props = {
  accion: (previo: EstadoProducto, formData: FormData) => Promise<EstadoProducto>
  categorias: Categoria[]
  producto?: ProductoEditable
}

const inicial: EstadoProducto = {}

const campo =
  'mt-1.5 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10'

const etiqueta = 'block text-sm font-medium text-stone-700'

export function FormularioProducto({ accion, categorias, producto }: Props) {
  const [estado, enviar, pendiente] = useActionState(accion, inicial)
  const editando = Boolean(producto)

  return (
    <form action={enviar} className="max-w-xl space-y-5">
      {producto ? <input type="hidden" name="id" value={producto.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
        <div>
          <label htmlFor="codigo" className={etiqueta}>
            Código
          </label>
          <input
            id="codigo"
            name="codigo"
            required
            maxLength={20}
            autoComplete="off"
            defaultValue={producto?.codigo}
            placeholder="ALM-001"
            className={`${campo} font-mono uppercase`}
          />
        </div>

        <div>
          <label htmlFor="descripcion" className={etiqueta}>
            Descripción
          </label>
          <input
            id="descripcion"
            name="descripcion"
            required
            maxLength={120}
            autoComplete="off"
            defaultValue={producto?.descripcion}
            placeholder="Yerba mate 1 kg"
            className={campo}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="categoriaId" className={etiqueta}>
            Categoría
          </label>
          <select
            id="categoriaId"
            name="categoriaId"
            defaultValue={producto?.categoriaId ?? ''}
            className={campo}
          >
            <option value="">Sin categoría</option>
            {categorias.map((categoria) => (
              <option key={categoria.id} value={categoria.id}>
                {categoria.nombre}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="precio" className={etiqueta}>
            Precio de venta
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-stone-500">
              $
            </span>
            <input
              id="precio"
              name="precio"
              required
              inputMode="decimal"
              autoComplete="off"
              defaultValue={producto ? aPesosEditables(producto.precio) : undefined}
              placeholder="4800,00"
              className={`${campo} pl-7 tabular-nums`}
            />
          </div>
          <p className="mt-1 text-xs text-stone-500">En pesos. Se guarda en centavos.</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="stockMinimo" className={etiqueta}>
            Stock mínimo
          </label>
          <input
            id="stockMinimo"
            name="stockMinimo"
            inputMode="numeric"
            autoComplete="off"
            defaultValue={producto?.stockMinimo ?? 0}
            className={`${campo} tabular-nums`}
          />
          <p className="mt-1 text-xs text-stone-500">Avisa cuando la existencia llegue a este número.</p>
        </div>

        {editando ? (
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-2 text-sm text-stone-700">
              <input
                type="checkbox"
                name="activo"
                defaultChecked={producto?.activo}
                className="size-4 rounded border-stone-300 accent-stone-900"
              />
              Producto activo (se puede vender)
            </label>
          </div>
        ) : (
          <div>
            <label htmlFor="stockInicial" className={etiqueta}>
              Stock inicial
            </label>
            <input
              id="stockInicial"
              name="stockInicial"
              inputMode="numeric"
              autoComplete="off"
              defaultValue={0}
              className={`${campo} tabular-nums`}
            />
            <p className="mt-1 text-xs text-stone-500">Se registra como una entrada en el historial.</p>
          </div>
        )}
      </div>

      {estado.error ? (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {estado.error}
        </p>
      ) : null}

      <div className="flex items-center gap-3 border-t border-stone-200 pt-5">
        <button
          type="submit"
          disabled={pendiente}
          className="whitespace-nowrap rounded-md bg-stone-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pendiente ? 'Guardando…' : editando ? 'Guardar cambios' : 'Crear producto'}
        </button>
        <p className="text-xs text-stone-500">
          {editando
            ? 'La existencia no se edita acá: se mueve con entradas y salidas.'
            : 'Después se puede editar el precio y el mínimo.'}
        </p>
      </div>
    </form>
  )
}
