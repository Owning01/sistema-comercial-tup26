import Link from 'next/link'
import { guardarUsuario } from '@/server/actions/usuarios'
import { requerirAdmin } from '@/server/auth'
import { FormularioUsuario } from '../form'

export const metadata = {
  title: 'Nuevo usuario · Sistema de Gestión Comercial',
}

export default async function NuevoUsuario() {
  await requerirAdmin()

  return (
    <div className="max-w-3xl">
      <Link
        href="/usuarios"
        className="font-mono text-xs tracking-[0.14em] text-stone-500 uppercase underline-offset-4 hover:text-stone-900 hover:underline"
      >
        ← Usuarios
      </Link>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">Nuevo usuario</h1>
      <p className="mt-2 max-w-prose text-stone-600">
        La contraseña se guarda como hash, nunca en texto plano. El usuario nuevo queda activo.
      </p>

      <div className="mt-8">
        <FormularioUsuario accion={guardarUsuario} />
      </div>
    </div>
  )
}
