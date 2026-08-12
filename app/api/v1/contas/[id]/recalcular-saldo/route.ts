export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server';
import { verifyAuth, getPerfilId } from '@/lib/auth/middleware';
import { handleError } from '@/lib/errors';
import * as contaService from '@/lib/services/conta.service';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { uid } = await verifyAuth(req);
    const perfilId = getPerfilId(req);
    const { id } = await params;
    
    const result = await contaService.recalcularSaldo(uid, perfilId, id);
    return Response.json(result);
  } catch (err) {
    return handleError(err);
  }
}
