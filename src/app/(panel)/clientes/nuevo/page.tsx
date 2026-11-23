import Link from 'next/link'
import { guardarCliente } from '@/server/actions/clientes'
import { FormularioCliente } from '../form'

export const metadata = {
  title: 'Nuevo cliente · Sistema de Gestión Comercial',
}

export default function NuevoCliente() {
  return (
    <div className="max-w-3xl">
      <Link
        href="/clientes"
        className="font-mono text-xs tracking-[0.14em] text-stone-500 uppercase underline-offset-4 hover:text-stone-900 hover:underline"
      >
        ← Clientes
      </Link>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">Nuevo cliente</h1>
      <p className="mt-2 max-w-prose text-stone-600">
        El documento identifica al cliente y no se puede repetir. La cuenta corriente se habilita
        acá y se puede cambiar después.
      </p>

      <div className="mt-8">
        <FormularioCliente accion={guardarCliente} />
      </div>
    </div>
  )
}
