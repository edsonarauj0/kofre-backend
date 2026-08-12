export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/auth/middleware';
import { handleError } from '@/lib/errors';
import * as perfilFinanceiroService from '@/lib/services/perfil-financeiro.service';

export async function GET(req: NextRequest) {
  try {
    const { uid } = await verifyAuth(req);
    
    const result = await perfilFinanceiroService.listarPerfis(uid);
    return Response.json(result);
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { uid } = await verifyAuth(req);
    const body = await req.json();
    
    const result = await perfilFinanceiroService.criarPerfil(uid, body);
    return Response.json(result, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
