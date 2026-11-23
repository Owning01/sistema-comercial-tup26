import { redirect } from 'next/navigation'
import { leerSesion } from '@/server/auth'
import { FormularioLogin } from './form'

export const metadata = {
  title: 'Entrar · Sistema de Gestión Comercial',
}

export default async function Login() {
  if (await leerSesion()) redirect('/')

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <span className="grid size-10 place-items-center bg-stone-900 font-mono text-sm font-bold text-white">
          SC
        </span>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">Sistema de Gestión Comercial</h1>
        <p className="mt-1 text-sm text-stone-600">Entrá con tu usuario para operar el sistema.</p>

        <FormularioLogin />

        <div className="mt-8 border-t border-stone-200 pt-5 text-sm text-stone-500">
          <p className="font-medium text-stone-700">Usuarios de prueba</p>
          <p className="mt-2 font-mono text-xs">admin@comercial.test · admin1234</p>
          <p className="font-mono text-xs">vendedor@comercial.test · vendedor1234</p>
        </div>
      </div>
    </main>
  )
}
