export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/auth/middleware';
import { handleError } from '@/lib/errors';
import * as telegramService from '@/lib/services/telegram.service';

export async function DELETE(req: NextRequest) {
  try {
    const { uid } = await verifyAuth(req);
    
    await telegramService.desvincularTelegram(uid);
    return new Response(null, { status: 204 });
  } catch (err) {
    return handleError(err);
  }
}
