import { adminDb } from '@/lib/firebase/admin';
import { atualizarSaldoConta } from './conta.service';
import { extrairEClassificarItensFatura, extrairTextoPdf } from './gemini.service';

export interface AnaliseFaturaResponse {
  itens: Array<{ descricao: string; valor: number; data?: string; categoriaId?: string; categoriaNome?: string; categoriaNova?: boolean }>;
  total: number;
}

export interface ProcessarFaturaRequest {
  itens: Array<{ descricao: string; valor: number; data?: string; categoriaId?: string; categoriaNome?: string; categoriaNova?: boolean; parcelaAtual?: number; totalParcelas?: number }>;
  contaId: string;
}

export interface ProcessarFaturaResponse {
  sucesso: boolean;
  transacoesCriadas: number;
}

export interface HistoricoImportacaoResponse {
  id: string;
  contaId: string;
  arquivo: string;
  data: string;
  totalTransacoes: number;
}

export async function analisarFatura(
  uid: string, 
  perfilId: string | null | undefined,
  contaId: string, 
  pdfBuffer: Buffer, 
  fileName: string
): Promise<AnaliseFaturaResponse> {
  const texto = await extrairTextoPdf(pdfBuffer);
  
  const basePath = perfilId ? `perfis/${perfilId}` : `usuarios/${uid}`;
  const catsSnapshot = await adminDb.collection(`${basePath}/categorias`).get();
  const categoriasDisponiveis = catsSnapshot.docs.map(doc => ({
    id: doc.id,
    nome: doc.data().nome,
    tipo: doc.data().tipo,
    grupo: doc.data().grupo || ''
  }));

  // Usa o Gemini para extrair as despesas do texto bruto (lidando com erros de OCR e texto esmagado) E classificar
  let itensExtraidos = await extrairEClassificarItensFatura(texto, categoriasDisponiveis);

  // Fallback: Se o Gemini falhar (sem chave de API ou erro), usamos a extração por Regex
  if (!itensExtraidos || itensExtraidos.length === 0) {
    const lines = texto.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const matchData = trimmed.match(/^.*?(\d{2}\/\d{2}|\d{2}\s+[A-Za-z]{3})\s+(.+?)\s+([R$\s\-−]*[\d.]+,\d{2}(?:\s*[-−])?)$/);
      const matchSemData = trimmed.match(/^(IOF|ANUIDADE|ENCARGOS|MULTA|MORA|JUROS|TARIFA)(.+?)\s+([R$\s\-−]*[\d.]+,\d{2}(?:\s*[-−])?)$/i);

      let descricao = '';
      let valorStr = '';

      if (matchData) {
        descricao = `${matchData[1]} ${matchData[2]}`.trim();
        valorStr = matchData[3];
      } else if (matchSemData) {
        descricao = `${matchSemData[1]}${matchSemData[2]}`.trim();
        valorStr = matchSemData[3];
      }

      if (descricao && valorStr) {
        const descUpper = descricao.toUpperCase();
        if (descUpper.includes('PAGTO') || descUpper.includes('PAGAMENTO') || descUpper.includes('REVERSAO')) {
          continue;
        }

        const isCredit = valorStr.includes('-') || valorStr.includes('−');
        const rawNumber = valorStr.replace(/[^\d,]/g, '').replace(',', '.');
        let valor = parseFloat(rawNumber);
        
        if (isCredit) {
          valor = -Math.abs(valor);
        }

        if (!isNaN(valor) && valor !== 0 && Math.abs(valor) < 1000000) {
          itensExtraidos.push({
            itemDescricao: descricao,
            valor,
            categoriaNome: 'Outros',
            categoriaNova: true
          });
        }
      }
    }
  }

  const mergedItens = itensExtraidos.map((item) => {
    return {
      descricao: item.itemDescricao,
      valor: item.valor,
      data: item.data,
      categoriaId: item.categoriaId,
      categoriaNome: item.categoriaNome || 'Outros',
      categoriaNova: item.categoriaNova || false,
      parcelaAtual: item.parcelaAtual || null,
      totalParcelas: item.totalParcelas || null
    };
  });

  const total = mergedItens.reduce((acc, curr) => acc + curr.valor, 0);

  return { itens: mergedItens, total };
}

export async function processarFatura(
  uid: string, 
  perfilId: string | null | undefined,
  data: ProcessarFaturaRequest
): Promise<ProcessarFaturaResponse> {
  const basePath = `usuarios/${uid}`;
  const resolvedPerfilId = perfilId || uid;
  const histRef = adminDb.collection(`${basePath}/importacoes`).doc();
  const importacaoId = histRef.id;
  let criadas = 0;
  let totalValor = 0;

  for (const item of data.itens) {
    let catId = item.categoriaId;

    if (item.categoriaNova && item.categoriaNome) {
      const catRef = adminDb.collection(`${basePath}/categorias`).doc();
      await catRef.set({
        nome: item.categoriaNome,
        tipo: 'DESPESA',
        perfilFinanceiroId: resolvedPerfilId,
        excluido: false,
        createdAt: new Date(),
        createdBy: uid,
        updatedAt: new Date(),
        updatedBy: uid
      });
      catId = catRef.id;
    }

    const rawDate = (item as any).dataLancamento || item.data;
    
    // Ensure invoice vencimento is used
    let dataVencFatura = (data as any).vencimento || null;
    if (dataVencFatura) {
      dataVencFatura = new Date(dataVencFatura).toISOString().slice(0, 10);
    } else {
      // Fallback to today if none provided (rare)
      dataVencFatura = new Date().toISOString().slice(0, 10);
    }
    
    let pAtual = item.parcelaAtual || null;
    let pTotal = item.totalParcelas || null;
    
    // Fallback if Gemini missed it, extract from description
    if (!pAtual || !pTotal) {
      const match = item.descricao.match(/\b(\d{1,2})\/(\d{1,2})\b/);
      if (match) {
        pAtual = parseInt(match[1], 10);
        pTotal = parseInt(match[2], 10);
      }
    }

    if (pAtual && pTotal && pTotal > 1 && pAtual <= pTotal) {
      const grupoParcelamentoId = adminDb.collection('dummy').doc().id;
      const parsedDataLancamento = new Date(rawDate ? rawDate : new Date());
      const parsedDataVencimento = new Date(dataVencFatura);
      const cleanDescricao = item.descricao.replace(/\s*\d{1,2}\/\d{1,2}\s*$/, '').trim();
      
      for (let i = pAtual; i <= pTotal; i++) {
         const dataLanc = new Date(parsedDataLancamento);
         dataLanc.setMonth(dataLanc.getMonth() + (i - pAtual));
         
         const dataVenc = new Date(parsedDataVencimento);
         dataVenc.setMonth(dataVenc.getMonth() + (i - pAtual));
         
         const parcelRef = adminDb.collection(`${basePath}/transacoes`).doc();
         await parcelRef.set({
            descricao: cleanDescricao,
            tipo: 'DESPESA',
            valor: item.valor,
            valorOriginal: item.valor,
            dataLancamento: dataLanc.toISOString().slice(0, 10),
            observacao: null,
            recorrente: false,
            meioPagamento: 'CREDITO',
            contaId: data.contaId,
            contaPagamentoId: null,
            categoriaId: catId || 'outros',
            statusPagamento: 'PENDENTE',
            dataVencimento: dataVenc.toISOString().slice(0, 10),
            dataPagamento: null,
            compartilhada: false,
            grupoCompartilhamentoId: null,
            parcelada: true,
            parcelaNumero: i,
            parcelaTotal: pTotal,
            grupoParcelamentoId: grupoParcelamentoId,
            divisoes: [],
            perfilFinanceiroId: resolvedPerfilId,
            origem: 'fatura',
            importacaoId: importacaoId,
            excluido: false,
            createdAt: new Date(),
            createdBy: uid,
            updatedAt: new Date(),
            updatedBy: uid
         });
         criadas++;
         totalValor += item.valor;
      }
    } else {
      const transacaoRef = adminDb.collection(`${basePath}/transacoes`).doc();
      await transacaoRef.set({
        descricao: item.descricao,
        tipo: 'DESPESA',
        valor: item.valor,
        valorOriginal: item.valor,
        dataLancamento: rawDate ? new Date(rawDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
        observacao: null,
        recorrente: false,
        meioPagamento: 'CREDITO',
        contaId: data.contaId,
        contaPagamentoId: null,
        categoriaId: catId || 'outros',
        statusPagamento: 'PENDENTE',
        dataVencimento: dataVencFatura,
        dataPagamento: null,
        compartilhada: false,
        grupoCompartilhamentoId: null,
        parcelada: false,
        parcelaNumero: null,
        parcelaTotal: null,
        grupoParcelamentoId: null,
        divisoes: [],
        perfilFinanceiroId: resolvedPerfilId,
        origem: 'fatura',
        importacaoId: importacaoId,
        excluido: false,
        createdAt: new Date(),
        createdBy: uid,
        updatedAt: new Date(),
        updatedBy: uid
      });
      criadas++;
      totalValor += (item.valor || 0);
    }
  }

  await histRef.set({
    contaId: data.contaId,
    perfilFinanceiroId: resolvedPerfilId,
    totalTransacoes: criadas,
    referencia: (data as any).referencia || '',
    vencimento: (data as any).vencimento || null,
    arquivo: (data as any).nomeArquivo || 'Fatura Importada',
    valorImportadoPdf: (data as any).totalFatura || 0,
    excluido: false,
    createdAt: new Date(),
    createdBy: uid,
    updatedAt: new Date(),
    updatedBy: uid
  });

  // Faturas de cartão de crédito criam lançamentos PENDENTES.
  // O saldo da conta SÓ DEVE SER ATUALIZADO quando a fatura for paga (transações marcadas como PAGO).
  // No Java backend, transações PENDENTES não descontam do saldo da conta principal até o pagamento.
  // if (totalValor > 0) {
  //   await atualizarSaldoConta(uid, data.contaId, -totalValor);
  // }

  return {
    sucesso: true,
    contaId: data.contaId,
    totalProcessado: criadas,
    totalFatura: (data as any).totalFatura || 0,
    importadoEm: new Date().toISOString()
  } as any;
}

export async function listarHistorico(
  uid: string, 
  perfilId: string | null | undefined, 
  contaId: string
): Promise<any[]> {
  const basePath = `usuarios/${uid}`;
  const snapshot = await adminDb.collection(`${basePath}/importacoes`)
    .where('contaId', '==', contaId)
    .where('excluido', '==', false)
    .orderBy('createdAt', 'desc')
    .limit(20)
    .get();

  if (snapshot.empty) return [];

  const importacoes = snapshot.docs.map(doc => ({
    id: doc.id,
    contaId: doc.data().contaId,
    arquivo: doc.data().arquivo || 'Fatura Importada',
    data: doc.data().createdAt?.toDate().toISOString(),
    totalTransacoes: doc.data().totalTransacoes,
    referencia: doc.data().referencia,
    vencimento: doc.data().vencimento,
    valorImportadoPdf: doc.data().valorImportadoPdf,
    transacoes: []
  })) as any[];

  // Fetch transacoes for these importacoes
  const transacoesSnap = await adminDb.collection(`${basePath}/transacoes`)
    .where('contaId', '==', contaId)
    .where('origem', '==', 'fatura')
    .where('excluido', '==', false)
    .get();
  
  if (!transacoesSnap.empty) {
    const allTransacoes = transacoesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    for (const imp of importacoes) {
      imp.transacoes = allTransacoes.filter((t: any) => t.importacaoId === imp.id);
    }
  }

  return importacoes;
}

export async function excluirImportacao(
  uid: string,
  perfilId: string | null | undefined,
  importacaoId: string
): Promise<void> {
  const basePath = `usuarios/${uid}`;
  
  const importacaoRef = adminDb.collection(`${basePath}/importacoes`).doc(importacaoId);
  await importacaoRef.update({
    excluido: true,
    updatedAt: new Date()
  });

  const snapshot = await adminDb.collection(`${basePath}/transacoes`)
    .where('importacaoId', '==', importacaoId)
    .get();

  if (!snapshot.empty) {
    let totalValor = 0;
    let contaIdDaImportacao: string | null = null;
    const batch = adminDb.batch();
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      if (!contaIdDaImportacao) contaIdDaImportacao = data.contaId;
      if (data.statusPagamento === 'PAGO') {
        totalValor += (data.valor || 0);
      }
      batch.update(doc.ref, { excluido: true, updatedAt: new Date() });
    });
    
    await batch.commit();

    if (totalValor > 0 && contaIdDaImportacao) {
      await atualizarSaldoConta(uid, contaIdDaImportacao, totalValor);
    }
  }
}
