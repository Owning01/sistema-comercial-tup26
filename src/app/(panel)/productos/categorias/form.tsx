'use client'

import { useActionState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  alternarCategoria,
  guardarCategoria,
  type EstadoCategoria,
} from '@/server/actions/productos'

type Categoria = { id: number; nombre: string; activa: boolean }

const inicial: EstadoCategoria = {}

function FilaCategoria({ categoria }: { categoria: Categoria }) {
  const [estado, enviar, pendiente] = useActionState(alternarCategoria, inicial)

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{categoria.nombre}</span>
        {categoria.activa ? (
          <Badge variant="secondary">Activa</Badge>
        ) : (
          <Badge variant="outline">Inactiva</Badge>
        )}
      </div>
      <form action={enviar} className="flex items-center gap-2">
        <input type="hidden" name="id" value={categoria.id} />
        <input type="hidden" name="activa" value={categoria.activa ? 'false' : 'true'} />
        <Button type="submit" variant="outline" size="sm" disabled={pendiente}>
          {pendiente ? 'Guardando…' : categoria.activa ? 'Desactivar' : 'Activar'}
        </Button>
      </form>
      {estado.error ? <p className="w-full text-xs text-red-700">{estado.error}</p> : null}
      {estado.ok ? <p className="w-full text-xs text-emerald-700">{estado.ok}</p> : null}
    </li>
  )
}

export function FormularioCategorias({ categorias }: { categorias: Categoria[] }) {
  const [estado, enviar, pendiente] = useActionState(guardarCategoria, inicial)

  return (
    <div className="space-y-8">
      <form action={enviar} className="rounded-lg border border-stone-200 bg-white p-5">
        <Label htmlFor="nombre">Nueva categoría</Label>
        <div className="mt-1.5 flex flex-wrap gap-2">
          <Input
            id="nombre"
            name="nombre"
            required
            maxLength={80}
            autoComplete="off"
            placeholder="Pinturería"
            className="max-w-xs flex-1"
          />
          <Button type="submit" disabled={pendiente}>
            {pendiente ? 'Creando…' : 'Crear categoría'}
          </Button>
        </div>
        {estado.error ? (
          <p role="alert" className="mt-2 text-sm text-red-700">
            {estado.error}
          </p>
        ) : null}
        {estado.ok ? (
          <p role="status" className="mt-2 text-sm text-emerald-700">
            {estado.ok}
          </p>
        ) : null}
      </form>

      {categorias.length === 0 ? (
        <p className="rounded-lg border border-dashed border-stone-300 px-4 py-8 text-center text-sm text-stone-600">
          Todavía no hay categorías.
        </p>
      ) : (
        <ul className="divide-y divide-stone-100 overflow-hidden rounded-lg border border-stone-200 bg-white">
          {categorias.map((categoria) => (
            <FilaCategoria key={categoria.id} categoria={categoria} />
          ))}
        </ul>
      )}
    </div>
  )
}
