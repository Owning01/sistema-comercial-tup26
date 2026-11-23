'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { iniciarSesion, type EstadoLogin } from '@/server/actions/auth'

const inicial: EstadoLogin = {}

export function FormularioLogin() {
  const [estado, accion, pendiente] = useActionState(iniciarSesion, inicial)

  return (
    <form action={accion} className="mt-8 space-y-4">
      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          defaultValue={estado.email}
          className="mt-1.5"
          placeholder="admin@comercial.test"
        />
      </div>

      <div>
        <Label htmlFor="password">Contraseña</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mt-1.5"
          placeholder="••••••••"
        />
      </div>

      {estado.error ? (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {estado.error}
        </p>
      ) : null}

      <Button type="submit" size="lg" disabled={pendiente} className="w-full">
        {pendiente ? 'Entrando…' : 'Entrar'}
      </Button>
    </form>
  )
}
