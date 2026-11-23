'use client'

import { useActionState, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { anularFactura, type EstadoAnulacion } from '@/server/actions/ventas'

const inicial: EstadoAnulacion = {}

export function FormularioAnulacion({ facturaId }: { facturaId: number }) {
  const [estado, enviar, pendiente] = useActionState(anularFactura, inicial)
  const [confirmado, setConfirmado] = useState(false)

  return (
    <form action={enviar} className="space-y-3">
      <input type="hidden" name="facturaId" value={facturaId} />

      <div>
        <Label htmlFor="motivo" className="text-xs text-stone-700">
          Motivo
        </Label>
        <Input
          id="motivo"
          name="motivo"
          required
          maxLength={200}
          autoComplete="off"
          placeholder="Error en la carga de cantidades"
          className="mt-1"
        />
      </div>

      <label className="flex items-start gap-2 text-xs text-stone-600">
        <input
          type="checkbox"
          checked={confirmado}
          onChange={(evento) => setConfirmado(evento.target.checked)}
          className="mt-0.5 size-4 accent-red-700"
        />
        Confirmo que quiero anular esta factura. Se reingresa el stock y no se puede deshacer.
      </label>

      <Button type="submit" variant="destructive" disabled={!confirmado || pendiente}>
        {pendiente ? 'Anulando…' : 'Anular factura'}
      </Button>

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
    </form>
  )
}
