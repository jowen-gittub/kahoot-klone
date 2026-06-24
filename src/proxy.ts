import { NextRequest, NextResponse } from 'next/server'

const PROTECTED = ['/admin', '/api/session']

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  const isProtected =
    PROTECTED.some(p => pathname === p || pathname.startsWith(p + '/')) &&
    // allow GET on /api/session (used by host panel to read session)
    !(pathname.startsWith('/api/session') && req.method === 'GET')

  if (!isProtected) return NextResponse.next()

  const auth = req.cookies.get('admin_auth')?.value
  if (auth === '1') return NextResponse.next()

  // API routes return 401; page routes redirect to login
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const loginUrl = req.nextUrl.clone()
  loginUrl.pathname = '/admin/login'
  loginUrl.searchParams.set('from', pathname)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ['/admin/:path*', '/api/session/:path*', '/api/session'],
}
