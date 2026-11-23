'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cambiarContrasena, type EstadoPassword } from '@/server/actions/auth'

const inicial: EstadoPassword = {}

export function FormularioPassword() {
  const [estado, enviar, pendiente] = useActionState(cambiarContrasena, inicial)

  return (
    <form action={enviar} className="space-y-4">
      <div>
        <Label htmlFor="actual">Contraseña actual</Label>
        <Input
          id="actual"
          name="actual"
          type="password"
          autoComplete="current-password"
          required
          className="mt-1.5"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="nueva">Contraseña nueva</Label>
          <Input
            id="nueva"
            name="nueva"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            className="mt-1.5"
          />
        </div>
        <div>
          <Label htmlFor="repetir">Repetir</Label>
          <Input
            id="repetir"
            name="repetir"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            className="mt-1.5"
          />
        </div>
      </div>

      {estado.error ? (
        <p role="alert" className="text-sm text-red-700">
          {estado.error}
        </p>
      ) : null}
      {estado.ok ? (
        <p role="status" className="text-sm text-emerald-700">
          {estado.ok}
        </p>
      ) : null}

      <Button type="submit" disabled={pendiente}>
        {pendiente ? 'Guardando…' : 'Cambiar contraseña'}
      </Button>
    </form>
  )
}
