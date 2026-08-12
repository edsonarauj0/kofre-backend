export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/auth/middleware';
import { handleError } from '@/lib/errors';
import * as perfilFinanceiroService from '@/lib/services/perfil-financeiro.service';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { uid } = await verifyAuth(req);
    const { id } = await params;
    
    await perfilFinanceiroService.excluirPerfil(uid, id);
    return new Response(null, { status: 204 });
  } catch (err) {
    return handleError(err);
  }
}
