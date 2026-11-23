import { NextResponse, type NextRequest } from 'next/server'

/**
 * Primera barrera: si no hay cookie de sesión, el pedido ni llega a la página.
 * La cookie se verifica de verdad en el layout y en cada servicio; acá solo se
 * evita renderizar el panel para un visitante sin sesión.
 */
export function proxy(request: NextRequest) {
  const token = request.cookies.get('sesion')?.value
  if (token) return NextResponse.next()

  const url = request.nextUrl.clone()
  url.pathname = '/login'
  url.search = ''
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/((?!api|login|_next/static|_next/image|favicon.ico).*)'],
}
