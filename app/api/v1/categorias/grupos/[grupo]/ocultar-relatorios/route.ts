export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server';
import { verifyAuth, getPerfilId } from '@/lib/auth/middleware';
import { handleError } from '@/lib/errors';
import * as categoriaService from '@/lib/services/categoria.service';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ grupo: string }> }
) {
  try {
    const { uid } = await verifyAuth(req);
    const perfilId = getPerfilId(req);
    const body = await req.json();
    const { grupo } = await params;
    
    const result = await categoriaService.atualizarVisibilidadeGrupo(uid, perfilId, grupo, body.ocultarRelatorios);
    return Response.json(result);
  } catch (err) {
    return handleError(err);
  }
}
