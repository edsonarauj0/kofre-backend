import { NextRequest } from 'next/server'
import { adminAuth } from '../firebase/admin'
import { UnauthorizedError } from '../errors'

export async function verifyAuth(req: NextRequest): Promise<{uid: string; email: string}> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError('Token não fornecido ou formato inválido')
  }

  const token = authHeader.split('Bearer ')[1]
  
  try {
    const decoded = await adminAuth.verifyIdToken(token)
    return {
      uid: decoded.uid,
      email: decoded.email || ''
    }
  } catch (error) {
    throw new UnauthorizedError('Token inválido ou expirado')
  }
}

export async function optionalAuth(req: NextRequest): Promise<{uid: string; email: string} | null> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }

  const token = authHeader.split('Bearer ')[1]
  try {
    const decoded = await adminAuth.verifyIdToken(token)
    return {
      uid: decoded.uid,
      email: decoded.email || ''
    }
  } catch {
    return null
  }
}

export function getPerfilId(req: NextRequest): string | null {
  return req.headers.get('X-Kofre-Perfil-Id')
}
