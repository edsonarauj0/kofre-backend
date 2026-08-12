import { adminDb } from '@/lib/firebase/admin';
import { atualizarResumoFinanceiroTelegram } from './firebase-telegram.service';

export async function sincronizarUsuario(uid: string): Promise<void> {
  const contasSnapshot = await adminDb.collection(`usuarios/${uid}/contas`).get();
  
  let saldoAtual = 0;
  contasSnapshot.forEach(doc => {
    const data = doc.data();
    saldoAtual += (data.saldo || 0);
  });

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const transacoesSnapshot = await adminDb.collection(`usuarios/${uid}/transacoes`)
    .where('data', '>=', thirtyDaysAgo)
    .get();

  let totalReceitas = 0;
  let totalDespesas = 0;

  transacoesSnapshot.forEach(doc => {
    const data = doc.data();
    const valor = parseFloat(data.valor || 0);
    if (data.tipo === 'receita') {
      totalReceitas += valor;
    } else if (data.tipo === 'despesa') {
      totalDespesas += valor;
    }
  });

  await atualizarResumoFinanceiroTelegram(uid, {
    saldoAtual,
    totalReceitas,
    totalDespesas,
    ultimaAtualizacao: new Date().toISOString()
  });
}
