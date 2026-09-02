import { adminDb } from '@/lib/firebase/admin';
import { extrairEClassificarItensFatura, extrairTextoPdf } from './gemini.service';

export interface AnaliseFaturaResponse {
  itens: Array<{ descricao: string; valor: number; data?: string; categoriaId?: string; categoriaNome?: string; categoriaNova?: boolean }>;
  total: number;
}

export interface ProcessarFaturaRequest {
  itens: Array<{ descricao: string; valor: number; data?: string; categoriaId?: string; categoriaNome?: string; categoriaNova?: boolean }>;
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
      categoriaNova: item.categoriaNova || false
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
  const basePath = perfilId ? `perfis/${perfilId}` : `usuarios/${uid}`;
  let criadas = 0;

  for (const item of data.itens) {
    let catId = item.categoriaId;

    if (item.categoriaNova && item.categoriaNome) {
      const catRef = adminDb.collection(`${basePath}/categorias`).doc();
      await catRef.set({
        nome: item.categoriaNome,
        tipo: 'despesa',
        createdAt: new Date()
      });
      catId = catRef.id;
    }

    const transacaoRef = adminDb.collection(`${basePath}/transacoes`).doc();
    const rawDate = (item as any).dataLancamento || item.data;
    await transacaoRef.set({
      descricao: item.descricao,
      tipo: 'DESPESA',
      valor: item.valor,
      valorOriginal: item.valor,
      dataLancamento: rawDate ? new Date(rawDate).toISOString() : new Date().toISOString(),
      observacao: null,
      recorrente: false,
      meioPagamento: null,
      contaId: data.contaId,
      contaPagamentoId: null,
      categoriaId: catId || 'outros',
      statusPagamento: 'PAGO',
      dataVencimento: null,
      dataPagamento: rawDate ? new Date(rawDate).toISOString() : new Date().toISOString(),
      compartilhada: false,
      grupoCompartilhamentoId: null,
      parcelada: false,
      parcelaNumero: null,
      parcelaTotal: null,
      grupoParcelamentoId: null,
      divisoes: [],
      perfilFinanceiroId: perfilId || uid,
      origem: 'fatura',
      createdAt: new Date(),
      createdBy: uid,
      updatedAt: new Date(),
      updatedBy: uid
    });
    criadas++;
  }

  const histRef = adminDb.collection(`${basePath}/importacoes`).doc();
  await histRef.set({
    contaId: data.contaId,
    totalTransacoes: criadas,
    referencia: (data as any).referencia || '',
    vencimento: (data as any).vencimento || null,
    arquivo: (data as any).nomeArquivo || 'Fatura Importada',
    valorImportadoPdf: (data as any).totalFatura || 0,
    excluido: false,
    createdAt: new Date()
  });

  return { sucesso: true, transacoesCriadas: criadas };
}

export async function listarHistorico(
  uid: string, 
  perfilId: string | null | undefined, 
  contaId: string
): Promise<HistoricoImportacaoResponse[]> {
  const basePath = perfilId ? `perfis/${perfilId}` : `usuarios/${uid}`;
  const snapshot = await adminDb.collection(`${basePath}/importacoes`)
    .where('contaId', '==', contaId)
    .where('excluido', '==', false)
    .orderBy('createdAt', 'desc')
    .limit(12)
    .get();

  return snapshot.docs.map(doc => ({
    id: doc.id,
    contaId: doc.data().contaId,
    arquivo: doc.data().arquivo || 'Fatura Importada',
    data: doc.data().createdAt?.toDate().toISOString(),
    totalTransacoes: doc.data().totalTransacoes,
    referencia: doc.data().referencia,
    vencimento: doc.data().vencimento,
    valorImportadoPdf: doc.data().valorImportadoPdf
  })) as HistoricoImportacaoResponse[];
}
