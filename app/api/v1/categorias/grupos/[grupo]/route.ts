export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server';
import { verifyAuth, getPerfilId } from '@/lib/auth/middleware';
import { handleError } from '@/lib/errors';
import * as categoriaService from '@/lib/services/categoria.service';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ grupo: string }> }
) {
  try {
    const { uid } = await verifyAuth(req);
    const perfilId = getPerfilId(req);
    const body = await req.json();
    const { grupo } = await params;
    
    const result = await categoriaService.atualizarGrupo(uid, perfilId, grupo, body.grupo);
    return Response.json(result);
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ grupo: string }> }
) {
  try {
    const { uid } = await verifyAuth(req);
    const perfilId = getPerfilId(req);
    const { grupo } = await params;
    
    await categoriaService.excluirGrupo(uid, perfilId, grupo);
    return new Response(null, { status: 204 });
  } catch (err) {
    return handleError(err);
  }
}
