import { NextRequest } from 'next/server';
import { verifyAuth, getPerfilId } from '@/lib/auth/middleware';
import { handleError, ErroValidacao } from '@/lib/errors';
import * as faturaCartaoService from '@/lib/services/fatura-cartao.service';

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { uid } = await verifyAuth(req);
    const perfilId = getPerfilId(req);
    
    if (!params.id) {
      throw new ErroValidacao('ID da importação não fornecido');
    }

    await faturaCartaoService.excluirImportacao(uid, perfilId, params.id);
    
    return Response.json({ sucesso: true });
  } catch (err) {
    return handleError(err);
  }
}
