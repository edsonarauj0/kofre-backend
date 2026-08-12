export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/auth/middleware';
import { handleError } from '@/lib/errors';
import { processarEventosPendentes } from '@/lib/services/telegram-event-processor.service';

export async function POST(req: NextRequest) {
  try {
    await verifyAuth(req);
    const searchParams = req.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') ?? '20', 10);

    const result = await processarEventosPendentes(limit);
    return Response.json(result);
  } catch (err) {
    return handleError(err);
  }
}
