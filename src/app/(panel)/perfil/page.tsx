import { requerirSesion } from '@/server/auth'
import { FormularioPassword } from './form'

export const metadata = {
  title: 'Mi cuenta · Sistema de Gestión Comercial',
}

export const dynamic = 'force-dynamic'

export default async function Perfil() {
  const sesion = await requerirSesion()

  return (
    <div className="max-w-xl">
      <p className="font-mono text-xs tracking-[0.14em] text-stone-500 uppercase">Mi cuenta</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Hola, {sesion.nombre}</h1>
      <p className="mt-2 text-stone-600">
        Sesión de {sesion.rol === 'admin' ? 'administrador' : 'vendedor'}. Cambiá tu contraseña
        cuando quieras; se guarda con hash, nunca en texto plano.
      </p>

      <div className="mt-8 rounded-lg border border-stone-200 bg-white p-5">
        <h2 className="text-sm font-medium text-stone-700">Cambiar contraseña</h2>
        <div className="mt-4">
          <FormularioPassword />
        </div>
      </div>
    </div>
  )
}
