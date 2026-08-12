import { adminDb } from '@/lib/firebase/admin';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';

export interface TelegramFirestoreMessageResponse {
  id: string;
  direction?: string;
  text?: string;
  status?: string;
  source?: string;
  telegramUpdateId?: number;
  createdAt?: string;
  metadata?: Record<string, unknown>;
}

export interface TelegramFirestoreEventResponse {
  id: string;
  text?: string;
  status?: string;
  source?: string;
  telegramUpdateId?: number;
  createdAt?: string;
  metadata?: Record<string, unknown>;
}

export interface TelegramPendingStructuredEvent {
  id: string;
  appUserId: string;
  text?: string;
  status?: string;
  telegramUpdateId?: number;
  createdAt?: string;
  metadata?: Record<string, unknown>;
}

export interface TelegramBridgeContextResponse {
  vinculado: boolean;
  sessaoAtiva: boolean;
  appUserId: string;
  appUserNome?: string;
  telegramChatId?: string;
  telegramUserId?: string;
  sessaoExpiraEm?: string;
}

export async function listarMensagens(appUserId: string, limite: number): Promise<TelegramFirestoreMessageResponse[]> {
  const snapshot = await adminDb
    .collection(`telegram_users/${appUserId}/messages`)
    .orderBy('createdAt', 'desc')
    .limit(limite)
    .get();

  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate().toISOString()
  })) as TelegramFirestoreMessageResponse[];
}

export async function listarEventos(appUserId: string, limite: number): Promise<TelegramFirestoreEventResponse[]> {
  const snapshot = await adminDb
    .collection(`telegram_users/${appUserId}/events`)
    .orderBy('createdAt', 'desc')
    .limit(limite)
    .get();

  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate().toISOString()
  })) as TelegramFirestoreEventResponse[];
}

export async function listarEventosEstruturadosPendentes(limite: number): Promise<TelegramPendingStructuredEvent[]> {
  const snapshot = await adminDb
    .collection('telegram_pending_events')
    .orderBy('createdAt', 'asc')
    .limit(limite)
    .get();

  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate().toISOString()
  })) as TelegramPendingStructuredEvent[];
}

export async function publicarTokenConexao(tokenHash: string, appUserId: string, appUserNome: string, expiraEm: string): Promise<void> {
  await adminDb.collection('telegram_connect_tokens').doc(tokenHash).set({
    appUserId,
    appUserNome,
    expiraEm: Timestamp.fromDate(new Date(expiraEm)),
    utilizado: false,
    createdAt: FieldValue.serverTimestamp()
  });
}

export async function invalidarTokenConexao(tokenHash: string): Promise<void> {
  await adminDb.collection('telegram_connect_tokens').doc(tokenHash).update({
    utilizado: true,
    updatedAt: FieldValue.serverTimestamp()
  });
}

export async function consultarContextoUsuario(appUserId: string): Promise<TelegramBridgeContextResponse> {
  const doc = await adminDb.collection('telegram_users').doc(appUserId).get();
  if (!doc.exists) {
    return {
      vinculado: false,
      sessaoAtiva: false,
      appUserId
    };
  }
  
  const data = doc.data()!;
  return {
    vinculado: !!data.vinculado,
    sessaoAtiva: !!data.sessaoAtiva,
    appUserId,
    appUserNome: data.appUserNome,
    telegramChatId: data.currentTelegramChatId,
    telegramUserId: data.currentTelegramUserId,
    sessaoExpiraEm: data.sessaoExpiraEm?.toDate().toISOString()
  };
}

export async function marcarDesvinculado(appUserId: string): Promise<void> {
  await adminDb.collection('telegram_users').doc(appUserId).set({
    vinculado: false,
    sessaoAtiva: false,
    currentTelegramChatId: null,
    currentTelegramUserId: null,
    sessaoExpiraEm: null,
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
}

export async function atualizarEventoTelegram(appUserId: string, eventId: string, status: string, metadata?: Record<string, unknown>): Promise<void> {
  const updateData: Record<string, any> = {
    status,
    updatedAt: FieldValue.serverTimestamp()
  };
  if (metadata) {
    updateData.metadata = metadata;
  }
  
  await adminDb.collection(`telegram_users/${appUserId}/events`).doc(eventId).set(updateData, { merge: true });
}

export async function atualizarEstadoUsuarioTelegram(appUserId: string, payload: Record<string, unknown>): Promise<void> {
  await adminDb.collection('telegram_users').doc(appUserId).set({
    ...payload,
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
}

export async function atualizarResumoFinanceiroTelegram(appUserId: string, payload: Record<string, unknown>): Promise<void> {
  await adminDb.collection('telegram_users').doc(appUserId).set({
    resumoFinanceiro: payload,
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
}

export async function buscarUsuarioTelegram(appUserId: string): Promise<Record<string, unknown>> {
  const doc = await adminDb.collection('telegram_users').doc(appUserId).get();
  return doc.exists ? doc.data() || {} : {};
}

export async function removerEventoTelegram(appUserId: string, eventId: string): Promise<void> {
  await adminDb.collection(`telegram_users/${appUserId}/events`).doc(eventId).delete();
  await adminDb.collection('telegram_pending_events').doc(eventId).delete();
}
