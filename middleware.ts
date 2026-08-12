import { NextRequest, NextResponse } from 'next/server'

function corsHeaders(origin: string | null) {
  const allowedOrigin = process.env.ALLOWED_ORIGIN

  return {
    'Access-Control-Allow-Origin': origin === allowedOrigin ? origin : allowedOrigin ?? '',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Kofre-Perfil-Id',
    'Vary': 'Origin',
  }
}

export function middleware(req: NextRequest) {
  const origin = req.headers.get('origin')
  const headers = corsHeaders(origin)

  if (req.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers })
  }

  const response = NextResponse.next()
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value)
  })
  return response
}

export const config = {
  matcher: '/api/:path*',
}