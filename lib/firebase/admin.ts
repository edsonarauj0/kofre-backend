import * as admin from 'firebase-admin'
import type { Auth } from 'firebase-admin/auth'
import type { Firestore } from 'firebase-admin/firestore'

// Lazy initialization — Firebase Admin só é inicializado na primeira requisição,
// nunca durante o build do Next.js (que não tem as env vars disponíveis).
function ensureInitialized(): boolean {
  if (admin.apps.length > 0) return true

  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')

  // Build time: env vars não disponíveis — retorna false silenciosamente
  if (!projectId || !clientEmail || !privateKey) return false

  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  })
  return true
}

// Proxy que adia a inicialização do Firebase até o primeiro acesso a uma propriedade.
// Se Firebase não estiver disponível (ex: build time), retorna funções que lançam erros
// informativos ao invés de travar o processo de build.
function createAuthProxy(): Auth {
  return new Proxy({} as Auth, {
    get(_target, prop: string | symbol) {
      if (!ensureInitialized()) {
        // Build time stub: retorna função no-op
        return (..._args: unknown[]) =>
          Promise.reject(new Error('Firebase Auth não inicializado (env vars ausentes)'))
      }
      const auth = admin.auth()
      const val = (auth as unknown as Record<string | symbol, unknown>)[prop]
      return typeof val === 'function' ? (val as Function).bind(auth) : val
    },
  })
}

function createDbProxy(): Firestore {
  return new Proxy({} as Firestore, {
    get(_target, prop: string | symbol) {
      if (!ensureInitialized()) {
        // Build time stub: retorna função no-op
        return (..._args: unknown[]) =>
          Promise.reject(new Error('Firebase Firestore não inicializado (env vars ausentes)'))
      }
      const db = admin.firestore()
      const val = (db as unknown as Record<string | symbol, unknown>)[prop]
      return typeof val === 'function' ? (val as Function).bind(db) : val
    },
  })
}

export const adminAuth = createAuthProxy()
export const adminDb = createDbProxy()
export default admin
