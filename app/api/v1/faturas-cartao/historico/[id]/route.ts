import { NextRequest } from 'next/server';
import { verifyAuth, getPerfilId } from '@/lib/auth/middleware';
import { handleError, AppError } from '@/lib/errors';
import * as faturaCartaoService from '@/lib/services/fatura-cartao.service';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { uid } = await verifyAuth(req);
    const perfilId = getPerfilId(req);
    const { id } = await params;
    
    if (!id) {
      throw new AppError('ID da importação não fornecido', 400);
    }

    await faturaCartaoService.excluirImportacao(uid, perfilId, id);
    
    return Response.json({ sucesso: true });
  } catch (err) {
    return handleError(err);
  }
}
