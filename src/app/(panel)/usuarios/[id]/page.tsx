import Link from 'next/link'
import { notFound } from 'next/navigation'
import { formatearFecha } from '@/lib/fechas'
import { ApiError } from '@/lib/errors'
import { actualizarUsuario } from '@/server/actions/usuarios'
import { requerirAdmin } from '@/server/auth'
import { obtenerUsuario } from '@/server/usuarios'
import { FormularioUsuario } from '../form'

export const dynamic = 'force-dynamic'

export default async function DetalleUsuario({ params }: { params: Promise<{ id: string }> }) {
  const sesion = await requerirAdmin()
  const { id: texto } = await params
  const id = Number(texto)

  if (!Number.isInteger(id) || id <= 0) notFound()

  let usuario
  try {
    usuario = await obtenerUsuario(sesion, id)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound()
    throw error
  }

  return (
    <div className="max-w-3xl">
      <Link
        href="/usuarios"
        className="font-mono text-xs tracking-[0.14em] text-stone-500 uppercase underline-offset-4 hover:text-stone-900 hover:underline"
      >
        ← Usuarios
      </Link>

      <h1 className="mt-3 text-3xl font-semibold tracking-tight">{usuario.nombre}</h1>
      <p className="mt-2 text-stone-600">
        {usuario.email} · {usuario.rol === 'admin' ? 'Administrador' : 'Vendedor'} ·{' '}
        {usuario.activo ? 'activo' : 'inactivo'} · desde {formatearFecha(usuario.creadoEn)}
      </p>

      <div className="mt-8">
        <FormularioUsuario
          accion={actualizarUsuario}
          usuario={usuario}
          esUnoMismo={usuario.id === sesion.id}
        />
      </div>
    </div>
  )
}
