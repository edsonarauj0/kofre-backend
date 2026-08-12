export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { handleError } from '@/lib/errors';
import { inicializarPerfilPadrao } from '@/lib/services/perfil-financeiro.service';
import { auditCreate } from '@/lib/firestore/helpers';

export async function POST(req: NextRequest) {
  try {
    const { nome, email, senha } = await req.json();

    try {
      const userRecord = await adminAuth.createUser({
        email,
        password: senha,
        displayName: nome,
      });

      const uid = userRecord.uid;
      
      const userData = {
        nome,
        email,
        moedaPadrao: 'BRL',
        fusoHorario: 'America/Sao_Paulo',
        perfil: 'USUARIO',
        ativo: true,
        ...auditCreate(uid),
      };

      await adminDb.collection('usuarios').doc(uid).set(userData);
      
      await inicializarPerfilPadrao(uid, nome);

      return Response.json({
        id: uid,
        nome,
        email,
        moedaPadrao: 'BRL',
        fusoHorario: 'America/Sao_Paulo'
      }, { status: 201 });
      
    } catch (authError: any) {
      if (authError.code === 'auth/email-already-exists') {
        return Response.json({ error: 'Já existe um usuário com este email' }, { status: 422 });
      }
      throw authError;
    }
  } catch (err) {
    return handleError(err);
  }
}
