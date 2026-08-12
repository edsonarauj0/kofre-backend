export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/auth/middleware';
import { handleError } from '@/lib/errors';
import { adminDb } from '@/lib/firebase/admin';

export async function GET(req: NextRequest) {
  try {
    const { uid } = await verifyAuth(req);
    const doc = await adminDb.collection('usuarios').doc(uid).get();
    
    if (!doc.exists) {
      return Response.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }
    
    const data = doc.data()!;
    return Response.json({
      id: uid,
      nome: data.nome,
      email: data.email,
      moedaPadrao: data.moedaPadrao,
      fusoHorario: data.fusoHorario,
    });
  } catch (err) {
    return handleError(err);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { uid } = await verifyAuth(req);
    const body = await req.json();
    const { moedaPadrao, fusoHorario } = body;
    
    const docRef = adminDb.collection('usuarios').doc(uid);
    await docRef.update({
      moedaPadrao,
      fusoHorario,
      updatedAt: new Date(),
    });
    
    const updated = await docRef.get();
    const data = updated.data()!;
    
    return Response.json({
      id: uid,
      nome: data.nome,
      email: data.email,
      moedaPadrao: data.moedaPadrao,
      fusoHorario: data.fusoHorario,
    });
  } catch (err) {
    return handleError(err);
  }
}
