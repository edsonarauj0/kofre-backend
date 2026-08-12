export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/auth/middleware';
import { handleError } from '@/lib/errors';
import * as telegramService from '@/lib/services/telegram.service';

export async function POST(req: NextRequest) {
  try {
    const { uid } = await verifyAuth(req);
    const searchParams = req.nextUrl.searchParams;
    const forceNew = searchParams.get('forceNew') === 'true';
    
    const result = await telegramService.gerarTokenDeConexao(uid, forceNew);
    return Response.json(result);
  } catch (err) {
    return handleError(err);
  }
}
