export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/auth/middleware';
import { handleError } from '@/lib/errors';
import { sincronizarUsuario } from '@/lib/services/telegram-financial-snapshot.service';

export async function POST(req: NextRequest) {
  try {
    const { uid } = await verifyAuth(req);

    await sincronizarUsuario(uid);
    return new Response(null, { status: 202 });
  } catch (err) {
    return handleError(err);
  }
}
