export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server';
import { verifyAuth, getPerfilId } from '@/lib/auth/middleware';
import { handleError } from '@/lib/errors';
import * as contaService from '@/lib/services/conta.service';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { uid } = await verifyAuth(req);
    const perfilId = getPerfilId(req);
    const body = await req.json();
    const { id } = await params;
    
    const result = await contaService.atualizarConta(uid, perfilId, id, body);
    return Response.json(result);
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { uid } = await verifyAuth(req);
    const perfilId = getPerfilId(req);
    const { id } = await params;
    
    await contaService.excluirConta(uid, perfilId, id);
    return new Response(null, { status: 204 });
  } catch (err) {
    return handleError(err);
  }
}
