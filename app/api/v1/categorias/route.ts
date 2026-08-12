export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server';
import { verifyAuth, getPerfilId } from '@/lib/auth/middleware';
import { handleError } from '@/lib/errors';
import * as categoriaService from '@/lib/services/categoria.service';

export async function GET(req: NextRequest) {
  try {
    const { uid } = await verifyAuth(req);
    const perfilId = getPerfilId(req);
    
    const result = await categoriaService.listarCategorias(uid, perfilId);
    return Response.json(result);
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { uid } = await verifyAuth(req);
    const perfilId = getPerfilId(req);
    const body = await req.json();
    
    const result = await categoriaService.criarCategoria(uid, perfilId, body);
    return Response.json(result, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
