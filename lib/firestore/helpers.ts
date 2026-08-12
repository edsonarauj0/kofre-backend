import { Timestamp } from 'firebase-admin/firestore'
import crypto from 'crypto'

export function fromDoc<T>(doc: FirebaseFirestore.DocumentSnapshot): T | null {
  if (!doc.exists) return null
  const data = doc.data()!
  return {
    ...data,
    id: doc.id,
    criadoEm: toIso(data.criadoEm),
    atualizadoEm: toIso(data.atualizadoEm)
  } as unknown as T
}

export function fromDocs<T>(docs: FirebaseFirestore.QueryDocumentSnapshot[]): T[] {
  return docs.map(doc => fromDoc<T>(doc) as T)
}

export function auditCreate(criadoPor = 'sistema') {
  const now = Timestamp.now()
  return {
    criadoEm: now,
    atualizadoEm: now,
    criadoPor,
    excluido: false
  }
}

export function auditUpdate() {
  return {
    atualizadoEm: Timestamp.now()
  }
}

export function newId(): string {
  return crypto.randomUUID()
}

export function toIso(ts: any): string | undefined {
  if (!ts) return undefined
  if (ts instanceof Timestamp) return ts.toDate().toISOString()
  if (ts && typeof ts.toDate === 'function') return ts.toDate().toISOString()
  if (typeof ts === 'string') return ts
  return undefined
}
