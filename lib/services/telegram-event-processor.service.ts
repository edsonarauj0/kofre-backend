import { adminDb } from '@/lib/firebase/admin';
import { listarEventosEstruturadosPendentes, removerEventoTelegram, atualizarEventoTelegram } from './firebase-telegram.service';
import { enviarMensagem } from './telegram-bot.service';
import { consultarContextoUsuario } from './firebase-telegram.service';

export async function processarEventosPendentes(limite: number = 50): Promise<{ processados: number; ignorados: number; falhas: number }> {
  const eventos = await listarEventosEstruturadosPendentes(limite);
  
  let processados = 0;
  let ignorados = 0;
  let falhas = 0;

  for (const evento of eventos) {
    try {
      if (!evento.metadata || !evento.metadata.intentType) {
        await atualizarEventoTelegram(evento.appUserId, evento.id, 'IGNORED');
        await removerEventoTelegram(evento.appUserId, evento.id);
        ignorados++;
        continue;
      }

      const intent = evento.metadata.intentType as string;
      const ctx = await consultarContextoUsuario(evento.appUserId);

      if (intent === 'create_transaction') {
        await processarCreateTransaction(evento, ctx.telegramChatId);
        processados++;
      } else if (intent === 'query_balance') {
        await processarQueryBalance(evento, ctx.telegramChatId);
        processados++;
      } else {
        await atualizarEventoTelegram(evento.appUserId, evento.id, 'IGNORED');
        await removerEventoTelegram(evento.appUserId, evento.id);
        ignorados++;
      }
    } catch (error) {
      console.error(`Erro ao processar evento ${evento.id}:`, error);
      await atualizarEventoTelegram(evento.appUserId, evento.id, 'FAILED', { error: (error as Error).message });
      falhas++;
    }
  }

  return { processados, ignorados, falhas };
}

async function processarCreateTransaction(evento: any, chatId?: string) {
  const transaction = evento.metadata.transaction;
  const uid = evento.appUserId;

  const userDoc = await adminDb.collection('usuarios').doc(uid).get();
  if (!userDoc.exists) throw new Error('Usuário não encontrado');
  
  const contasSnapshot = await adminDb.collection(`usuarios/${uid}/contas`).limit(1).get();
  if (contasSnapshot.empty) throw new Error('Nenhuma conta encontrada');
  
  const contaId = contasSnapshot.docs[0].id;
  
  let categoriaId = 'outros';
  const nomeCategoria = transaction.categoriaSugerida || 'Outros';
  
  const categoriasSnapshot = await adminDb.collection(`usuarios/${uid}/categorias`)
    .where('nome', '==', nomeCategoria).limit(1).get();
    
  if (categoriasSnapshot.empty) {
    const novaCatRef = adminDb.collection(`usuarios/${uid}/categorias`).doc();
    await novaCatRef.set({
      nome: nomeCategoria,
      tipo: transaction.tipo || 'despesa',
      cor: '#999999',
      createdAt: new Date()
    });
    categoriaId = novaCatRef.id;
  } else {
    categoriaId = categoriasSnapshot.docs[0].id;
  }

  const transacaoRef = adminDb.collection(`usuarios/${uid}/transacoes`).doc();
  await transacaoRef.set({
    contaId,
    categoriaId,
    tipo: transaction.tipo || 'despesa',
    valor: parseFloat(transaction.valor) || 0,
    data: transaction.dataLancamento ? new Date(transaction.dataLancamento) : new Date(),
    descricao: transaction.descricao || 'Despesa via Telegram',
    origem: 'telegram',
    createdAt: new Date()
  });

  await removerEventoTelegram(uid, evento.id);

  if (chatId) {
    await enviarMensagem(chatId, `✅ Transação registrada: ${transaction.descricao} - R$ ${transaction.valor}`);
  }
}

async function processarQueryBalance(evento: any, chatId?: string) {
  const uid = evento.appUserId;
  await removerEventoTelegram(uid, evento.id);
  
  if (chatId) {
    await enviarMensagem(chatId, `📊 Consultas de saldo ainda estão sendo aprimoradas. Consulte o app Kofre para mais detalhes!`);
  }
}
