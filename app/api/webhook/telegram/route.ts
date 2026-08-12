export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server';
import { handleError } from '@/lib/errors';
import * as telegramBotService from '@/lib/services/telegram-bot.service';

export async function POST(req: NextRequest) {
  try {
    const secretToken = req.headers.get('X-Telegram-Bot-Api-Secret-Token');
    
    if (process.env.TELEGRAM_WEBHOOK_SECRET && secretToken !== process.env.TELEGRAM_WEBHOOK_SECRET) {
      return Response.json({ error: 'Não autorizado' }, { status: 401 });
    }
    
    const update = await req.json();
    
    await telegramBotService.processarWebhook(update);
    return new Response('OK', { status: 200 });
  } catch (err) {
    return handleError(err);
  }
}
