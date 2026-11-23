'use client'

import { useActionState } from 'react'
import { iniciarSesion, type EstadoLogin } from '@/server/actions/auth'

const inicial: EstadoLogin = {}

export function FormularioLogin() {
  const [estado, accion, pendiente] = useActionState(iniciarSesion, inicial)

  return (
    <form action={accion} className="mt-8 space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-stone-700">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          defaultValue={estado.email}
          className="mt-1.5 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10"
          placeholder="admin@comercial.test"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-stone-700">
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mt-1.5 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10"
          placeholder="••••••••"
        />
      </div>

      {estado.error ? (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {estado.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pendiente}
        className="w-full rounded-md bg-stone-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pendiente ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  )
}
