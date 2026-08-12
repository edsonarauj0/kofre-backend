export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/auth/middleware';
import { handleError } from '@/lib/errors';
import { listarMensagens } from '@/lib/services/firebase-telegram.service';

export async function GET(req: NextRequest) {
  try {
    const { uid } = await verifyAuth(req);
    const searchParams = req.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') ?? '50', 10);

    const result = await listarMensagens(uid, limit);
    return Response.json(result);
  } catch (err) {
    return handleError(err);
  }
}
