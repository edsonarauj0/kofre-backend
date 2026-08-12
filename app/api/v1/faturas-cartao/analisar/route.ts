export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server';
import { verifyAuth, getPerfilId } from '@/lib/auth/middleware';
import { handleError } from '@/lib/errors';
import * as faturaCartaoService from '@/lib/services/fatura-cartao.service';

export async function POST(req: NextRequest) {
  try {
    const { uid } = await verifyAuth(req);
    const perfilId = getPerfilId(req);
    
    const formData = await req.formData();
    const arquivo = formData.get('arquivo') as File | null;
    const contaId = formData.get('contaId') as string;
    
    if (!arquivo) {
      return Response.json({ error: 'Arquivo não fornecido' }, { status: 400 });
    }
    
    if (!contaId) {
      return Response.json({ error: 'ID da conta não fornecido' }, { status: 400 });
    }
    
    const arrayBuffer = await arquivo.arrayBuffer();
    const pdfBuffer = Buffer.from(arrayBuffer);
    
    const result = await faturaCartaoService.analisarFatura(uid, perfilId, contaId, pdfBuffer, arquivo.name);
    return Response.json(result);
  } catch (err) {
    return handleError(err);
  }
}
