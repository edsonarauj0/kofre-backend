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
  const itensExtraidos = await extrairEClassificarItensFatura(texto, categoriasDisponiveis);

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
    await transacaoRef.set({
      contaId: data.contaId,
      categoriaId: catId || 'outros',
      valor: item.valor,
      descricao: item.descricao,
      data: item.data ? new Date(item.data) : new Date(),
      tipo: 'despesa',
      origem: 'fatura',
      createdAt: new Date()
    });
    criadas++;
  }

  const histRef = adminDb.collection(`${basePath}/importacoes`).doc();
  await histRef.set({
    contaId: data.contaId,
    totalTransacoes: criadas,
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
    totalTransacoes: doc.data().totalTransacoes
  })) as HistoricoImportacaoResponse[];
}
