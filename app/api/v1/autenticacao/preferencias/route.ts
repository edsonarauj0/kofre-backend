export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import { verifyAuth } from '@/lib/auth/middleware'
import { handleError } from '@/lib/errors'
import { adminDb } from '@/lib/firebase/admin'
import { auditUpdate } from '@/lib/firestore/helpers'

// PUT /api/v1/autenticacao/preferencias — atualiza moeda e fuso horário
export async function PUT(req: NextRequest) {
  try {
    const { uid } = await verifyAuth(req)
    const { moedaPadrao, fusoHorario } = await req.json()

    const docRef = adminDb.collection('usuarios').doc(uid)
    await docRef.update({ moedaPadrao, fusoHorario, ...auditUpdate() })

    const updated = await docRef.get()
    const data = updated.data()!

    return Response.json({
      id: uid,
      nome: data.nome,
      email: data.email,
      moedaPadrao: data.moedaPadrao,
      fusoHorario: data.fusoHorario,
    })
  } catch (err) {
    return handleError(err)
  }
}
