export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server';
import { handleError } from '@/lib/errors';
import * as telegramService from '@/lib/services/telegram.service';

export async function POST(req: NextRequest) {
  try {
    const internalSecret = req.headers.get('X-Kofre-Internal-Secret');
    
    if (!internalSecret || internalSecret !== process.env.TELEGRAM_BRIDGE_SECRET) {
      return Response.json({ error: 'Não autorizado' }, { status: 401 });
    }
    
    const body = await req.json();
    const { token, telegramChatId, telegramUserId } = body;
    
    const result = await telegramService.vincularPorToken(token, telegramChatId, telegramUserId);
    return Response.json(result);
  } catch (err) {
    return handleError(err);
  }
}
