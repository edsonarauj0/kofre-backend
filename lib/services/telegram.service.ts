import { adminDb } from '@/lib/firebase/admin';
import * as crypto from 'crypto';
import { 
  publicarTokenConexao, 
  invalidarTokenConexao, 
  marcarDesvinculado, 
  atualizarEstadoUsuarioTelegram,
  TelegramBridgeContextResponse
} from './firebase-telegram.service';

export interface TelegramConnectTokenResponse {
  token: string;
  expiraEm: string;
  comando: string;
}

export interface TelegramLinkStatusResponse {
  vinculado: boolean;
  sessaoAtiva: boolean;
  telegramChatIdMascarado?: string;
  telegramUserIdMascarado?: string;
  sessaoExpiraEm?: string;
}

function mascararId(id: string): string {
  if (!id || id.length <= 3) return id;
  return '*'.repeat(id.length - 3) + id.substring(id.length - 3);
}

export async function gerarTokenDeConexao(uid: string, forceNew: boolean = false): Promise<TelegramConnectTokenResponse> {
  const token = Math.floor(100000 + Math.random() * 900000).toString();
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  
  const expiraEmDate = new Date();
  expiraEmDate.setMinutes(expiraEmDate.getMinutes() + 15);
  const expiraEm = expiraEmDate.toISOString();

  // Load user details
  const userDoc = await adminDb.collection('usuarios').doc(uid).get();
  const appUserNome = userDoc.exists ? (userDoc.data()?.nome || 'Usuário') : 'Usuário';

  await publicarTokenConexao(tokenHash, uid, appUserNome, expiraEm);

  return {
    token,
    expiraEm,
    comando: `/conectar ${token}`
  };
}

export async function vincularPorToken(token: string, telegramChatId: string, telegramUserId: string): Promise<{ nome: string }> {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const tokenDoc = await adminDb.collection('telegram_connect_tokens').doc(tokenHash).get();
  
  if (!tokenDoc.exists) {
    throw new Error('Token inválido ou expirado.');
  }
  
  const data = tokenDoc.data()!;
  if (data.utilizado) {
    throw new Error('Token já utilizado.');
  }
  
  if (data.expiraEm.toDate() < new Date()) {
    throw new Error('Token expirado.');
  }

  const uid = data.appUserId;
  const nome = data.appUserNome || 'Usuário';

  await invalidarTokenConexao(tokenHash);

  // Update user links
  await adminDb.collection('telegram_user_links').doc(uid).set({
    usuarioId: uid,
    telegramChatId,
    telegramUserId,
    ativo: true,
    updatedAt: new Date()
  });

  // Create session
  const expiraEmSession = new Date();
  expiraEmSession.setHours(expiraEmSession.getHours() + 24);

  const newSessionRef = adminDb.collection('telegram_sessions').doc();
  await newSessionRef.set({
    usuarioId: uid,
    telegramUserId,
    expiraEm: expiraEmSession,
    ativa: true,
    createdAt: new Date()
  });

  // Update telegram user state
  await atualizarEstadoUsuarioTelegram(uid, {
    vinculado: true,
    sessaoAtiva: true,
    currentTelegramChatId: telegramChatId,
    currentTelegramUserId: telegramUserId,
    sessaoExpiraEm: expiraEmSession,
    appUserNome: nome
  });

  return { nome };
}

export async function consultarStatus(uid: string): Promise<TelegramLinkStatusResponse> {
  const linkDoc = await adminDb.collection('telegram_user_links').doc(uid).get();
  
  if (!linkDoc.exists || !linkDoc.data()?.ativo) {
    return {
      vinculado: false,
      sessaoAtiva: false
    };
  }

  const linkData = linkDoc.data()!;
  
  const sessions = await adminDb.collection('telegram_sessions')
    .where('usuarioId', '==', uid)
    .where('ativa', '==', true)
    .where('expiraEm', '>', new Date())
    .limit(1)
    .get();

  const sessaoAtiva = !sessions.empty;
  let sessaoExpiraEm;
  if (sessaoAtiva) {
    sessaoExpiraEm = sessions.docs[0].data().expiraEm.toDate().toISOString();
  }

  return {
    vinculado: true,
    sessaoAtiva,
    telegramChatIdMascarado: mascararId(linkData.telegramChatId),
    telegramUserIdMascarado: mascararId(linkData.telegramUserId),
    sessaoExpiraEm
  };
}

export async function desvincularTelegram(uid: string): Promise<void> {
  await adminDb.collection('telegram_user_links').doc(uid).update({
    ativo: false,
    updatedAt: new Date()
  });
  
  const sessions = await adminDb.collection('telegram_sessions')
    .where('usuarioId', '==', uid)
    .where('ativa', '==', true)
    .get();
    
  const batch = adminDb.batch();
  sessions.docs.forEach(doc => {
    batch.update(doc.ref, { ativa: false, updatedAt: new Date() });
  });
  await batch.commit();

  await marcarDesvinculado(uid);
}

export async function consultarContextoBot(telegramUserId: string, telegramChatId: string): Promise<TelegramBridgeContextResponse> {
  const links = await adminDb.collection('telegram_user_links')
    .where('telegramUserId', '==', telegramUserId)
    .where('ativo', '==', true)
    .limit(1)
    .get();

  if (links.empty) {
    return { vinculado: false, sessaoAtiva: false, appUserId: '' };
  }

  const uid = links.docs[0].data().usuarioId;
  const sessions = await adminDb.collection('telegram_sessions')
    .where('usuarioId', '==', uid)
    .where('telegramUserId', '==', telegramUserId)
    .where('ativa', '==', true)
    .where('expiraEm', '>', new Date())
    .limit(1)
    .get();

  const sessaoAtiva = !sessions.empty;
  let sessaoExpiraEm;
  if (sessaoAtiva) {
    sessaoExpiraEm = sessions.docs[0].data().expiraEm.toDate().toISOString();
  }

  const userDoc = await adminDb.collection('telegram_users').doc(uid).get();
  const nome = userDoc.exists ? userDoc.data()?.appUserNome : undefined;

  return {
    vinculado: true,
    sessaoAtiva,
    appUserId: uid,
    appUserNome: nome,
    telegramChatId,
    telegramUserId,
    sessaoExpiraEm
  };
}

export async function usuarioEstaVinculado(telegramUserId: string, telegramChatId: string): Promise<boolean> {
  const contexto = await consultarContextoBot(telegramUserId, telegramChatId);
  return contexto.vinculado;
}

export async function temSessaoAtiva(telegramUserId: string): Promise<boolean> {
  const sessions = await adminDb.collection('telegram_sessions')
    .where('telegramUserId', '==', telegramUserId)
    .where('ativa', '==', true)
    .where('expiraEm', '>', new Date())
    .limit(1)
    .get();
    
  return !sessions.empty;
}
