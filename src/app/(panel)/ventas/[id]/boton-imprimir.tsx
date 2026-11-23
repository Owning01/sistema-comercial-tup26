'use client'

export function BotonImprimir() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-md border border-stone-300 px-4 py-2.5 text-sm font-medium hover:bg-stone-100 print:hidden"
    >
      Imprimir comprobante
    </button>
  )
}
