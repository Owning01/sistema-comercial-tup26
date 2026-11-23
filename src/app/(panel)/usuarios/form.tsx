'use client'

import { useActionState } from 'react'
import { useRestaurarFormulario } from '@/lib/formulario'
import type { EstadoUsuario } from '@/server/actions/usuarios'

type UsuarioEditable = {
  id: number
  nombre: string
  email: string
  rol: 'admin' | 'vendedor'
  activo: boolean
}

type Props = {
  accion: (previo: EstadoUsuario, formData: FormData) => Promise<EstadoUsuario>
  usuario?: UsuarioEditable
  esUnoMismo?: boolean
}

const inicial: EstadoUsuario = {}

const campo =
  'mt-1.5 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10'

const etiqueta = 'block text-sm font-medium text-stone-700'

export function FormularioUsuario({ accion, usuario, esUnoMismo }: Props) {
  const [estado, enviar, pendiente] = useActionState(accion, inicial)
  const restaurador = useRestaurarFormulario(estado)
  const editando = Boolean(usuario)

  return (
    <form ref={restaurador.ref} onSubmit={restaurador.onSubmit} action={enviar} className="max-w-xl space-y-5">
      {usuario ? <input type="hidden" name="id" value={usuario.id} /> : null}

      <div>
        <label htmlFor="nombre" className={etiqueta}>
          Nombre
        </label>
        <input
          id="nombre"
          name="nombre"
          required
          maxLength={120}
          autoComplete="off"
          defaultValue={usuario?.nombre}
          placeholder="Ana Pérez"
          className={campo}
        />
      </div>

      <div>
        <label htmlFor="email" className={etiqueta}>
          Email de acceso
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          maxLength={120}
          autoComplete="off"
          defaultValue={usuario?.email}
          placeholder="usuario@comercial.test"
          className={campo}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="rol" className={etiqueta}>
            Rol
          </label>
          <select
            id="rol"
            name="rol"
            defaultValue={usuario?.rol ?? 'vendedor'}
            disabled={esUnoMismo}
            className={campo}
          >
            <option value="vendedor">Vendedor</option>
            <option value="admin">Administrador</option>
          </select>
          {esUnoMismo ? <input type="hidden" name="rol" value="admin" /> : null}
          <p className="mt-1 text-xs text-stone-500">
            Solo el administrador puede gestionar usuarios.
          </p>
        </div>

        <div>
          <label htmlFor="password" className={etiqueta}>
            {editando ? 'Contraseña nueva' : 'Contraseña'}
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required={!editando}
            minLength={editando ? undefined : 8}
            maxLength={100}
            autoComplete="new-password"
            placeholder={editando ? 'Dejar vacío para conservar' : 'Mínimo 8 caracteres'}
            className={campo}
          />
        </div>
      </div>

      {editando ? (
        <label className="flex items-center gap-2 text-sm text-stone-700">
          <input
            type="checkbox"
            name="activo"
            defaultChecked={usuario?.activo}
            disabled={esUnoMismo}
            className="size-4 rounded border-stone-300 accent-stone-900"
          />
          Usuario activo
        </label>
      ) : null}

      {esUnoMismo ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          No podés desactivar tu propio usuario ni quitarte el rol de administrador.
        </p>
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
          {pendiente ? 'Guardando…' : editando ? 'Guardar cambios' : 'Crear usuario'}
        </button>
      </div>
    </form>
  )
}
