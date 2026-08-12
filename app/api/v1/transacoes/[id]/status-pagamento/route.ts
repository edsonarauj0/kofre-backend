export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server';
import { verifyAuth, getPerfilId } from '@/lib/auth/middleware';
import { handleError } from '@/lib/errors';
import * as transacaoService from '@/lib/services/transacao.service';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { uid } = await verifyAuth(req);
    const perfilId = getPerfilId(req);
    const body = await req.json();
    const { id } = await params;
    
    const result = await transacaoService.atualizarStatusPagamento(uid, perfilId, id, body.status);
    return Response.json(result);
  } catch (err) {
    return handleError(err);
  }
}
