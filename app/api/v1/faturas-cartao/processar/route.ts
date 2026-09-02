export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest } from 'next/server';
import { verifyAuth, getPerfilId } from '@/lib/auth/middleware';
import { handleError } from '@/lib/errors';
import * as faturaCartaoService from '@/lib/services/fatura-cartao.service';

export async function POST(req: NextRequest) {
  try {
    const { uid } = await verifyAuth(req);
    const perfilId = getPerfilId(req);
    const body = await req.json();
    
    const result = await faturaCartaoService.processarFatura(uid, perfilId, body);
    return Response.json(result);
  } catch (err) {
    return handleError(err);
  }
}
