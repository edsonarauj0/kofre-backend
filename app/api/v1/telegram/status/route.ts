export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/auth/middleware';
import { handleError } from '@/lib/errors';
import * as telegramService from '@/lib/services/telegram.service';

export async function GET(req: NextRequest) {
  try {
    const { uid } = await verifyAuth(req);
    
    const result = await telegramService.consultarStatus(uid);
    return Response.json(result);
  } catch (err) {
    return handleError(err);
  }
}
