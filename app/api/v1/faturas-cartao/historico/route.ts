export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server';
import { verifyAuth, getPerfilId } from '@/lib/auth/middleware';
import { handleError } from '@/lib/errors';
import * as faturaCartaoService from '@/lib/services/fatura-cartao.service';

export async function GET(req: NextRequest) {
  try {
    const { uid } = await verifyAuth(req);
    const perfilId = getPerfilId(req);
    
    const searchParams = req.nextUrl.searchParams;
    const contaId = searchParams.get('contaId') ?? '';

    const result = await faturaCartaoService.listarHistorico(uid, perfilId, contaId);
    return Response.json(result);
  } catch (err) {
    return handleError(err);
  }
}
