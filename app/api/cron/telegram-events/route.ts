export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server';
import { handleError } from '@/lib/errors';
import { processarEventosPendentes } from '@/lib/services/telegram-event-processor.service';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');

    if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return Response.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const result = await processarEventosPendentes(20);
    return Response.json(result);
  } catch (err) {
    return handleError(err);
  }
}
