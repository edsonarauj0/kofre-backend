import { adminDb } from '../firebase/admin'
import { StatusPagamentoUpdateRequest, TransacaoDoc, TransacaoRequest } from '../../types'
import { auditCreate, auditUpdate, fromDoc, fromDocs, newId } from '../firestore/helpers'
import { BusinessRuleError, NotFoundError } from '../errors'
import { resolverPerfil } from './perfil-financeiro.service'
import { atualizarSaldoConta } from './conta.service'

const COLLECTION = 'transacoes'

function getCollectionRef(uid: string) {
  return adminDb.collection('usuarios').doc(uid).collection(COLLECTION)
}

export async function listarTransacoes(uid: string, perfilId?: string | null): Promise<TransacaoDoc[]> {
  const perfil = await resolverPerfil(uid, perfilId)
  const snap = await getCollectionRef(uid)
    .where('excluido', '==', false)
    .where('perfilFinanceiroId', '==', perfil.id)
    .get()
  return fromDocs<TransacaoDoc>(snap.docs)
}

export async function criarTransacao(uid: string, perfilId: string | null | undefined, data: TransacaoRequest): Promise<TransacaoDoc> {
  const perfil = await resolverPerfil(uid, perfilId)
  
  if (data.quantidadeParcelas && data.quantidadeParcelas > 1) {
    // For simplicity returning the first in case of multiples
    // Proper logic would create all parcelas, use batch, return the group or first doc
    const grupoParcelamentoId = newId()
    const transacoes: TransacaoDoc[] = []
    const valorParcela = Number((data.valor / data.quantidadeParcelas).toFixed(2))
    const batch = adminDb.batch()
    const ref = getCollectionRef(uid)

    for (let i = 1; i <= data.quantidadeParcelas; i++) {
      const tId = newId()
      const docRef = ref.doc(tId)
      const tData = buildTransacaoData(uid, perfil.id, data, valorParcela, true, i, data.quantidadeParcelas, grupoParcelamentoId)
      batch.set(docRef, tData)
      transacoes.push({ ...tData, id: tId } as unknown as TransacaoDoc)
      await updateBalances(uid, tData)
    }
    await batch.commit()
    return transacoes[0]
  } else {
    const tId = newId()
    const docRef = getCollectionRef(uid).doc(tId)
    const tData = buildTransacaoData(uid, perfil.id, data, data.valor, false)
    await docRef.set(tData)
    await updateBalances(uid, tData)
    const doc = await docRef.get()
    return fromDoc<TransacaoDoc>(doc)!
  }
}

export async function atualizarTransacao(uid: string, perfilId: string | null | undefined, transacaoId: string, data: TransacaoRequest): Promise<TransacaoDoc> {
  const perfil = await resolverPerfil(uid, perfilId)
  const ref = getCollectionRef(uid).doc(transacaoId)
  const doc = await ref.get()
  if (!doc.exists) throw new NotFoundError('Transação não encontrada')
  
  const oldData = fromDoc<TransacaoDoc>(doc)!
  if (oldData.perfilFinanceiroId !== perfil.id) throw new NotFoundError('Transação não encontrada')

  // Reverse old balances
  await reverseBalances(uid, oldData)

  const newData = {
    ...oldData,
    ...data,
    valorOriginal: data.valor,
    divisoes: mapDivisoes(data.divisoes, perfil),
    ...auditUpdate()
  }

  await ref.update(newData)
  await updateBalances(uid, newData as any)

  const updatedDoc = await ref.get()
  return fromDoc<TransacaoDoc>(updatedDoc)!
}

export async function atualizarStatusPagamento(uid: string, perfilId: string | null | undefined, transacaoId: string, data: StatusPagamentoUpdateRequest): Promise<TransacaoDoc> {
  const perfil = await resolverPerfil(uid, perfilId)
  const ref = getCollectionRef(uid).doc(transacaoId)
  const doc = await ref.get()
  if (!doc.exists) throw new NotFoundError('Transação não encontrada')
  
  const t = fromDoc<TransacaoDoc>(doc)!
  if (t.perfilFinanceiroId !== perfil.id) throw new NotFoundError('Transação não encontrada')

  await ref.update({
    statusPagamento: data.statusPagamento,
    dataAgendamentoPagamento: data.dataAgendamentoPagamento || null,
    dataPagamento: data.dataPagamento || null,
    contaPagamentoId: data.contaPagamentoId || t.contaPagamentoId,
    ...auditUpdate()
  })
  const updatedDoc = await ref.get()
  return fromDoc<TransacaoDoc>(updatedDoc)!
}

export async function excluirTransacao(uid: string, perfilId: string | null | undefined, transacaoId: string): Promise<void> {
  const perfil = await resolverPerfil(uid, perfilId)
  const ref = getCollectionRef(uid).doc(transacaoId)
  const doc = await ref.get()
  if (!doc.exists) throw new NotFoundError('Transação não encontrada')
  
  const t = fromDoc<TransacaoDoc>(doc)!
  if (t.perfilFinanceiroId !== perfil.id) throw new NotFoundError('Transação não encontrada')

  await reverseBalances(uid, t)
  await ref.update({ excluido: true, ...auditUpdate() })
}

// Helpers
function buildTransacaoData(uid: string, perfilId: string, req: TransacaoRequest, valor: number, parcelada: boolean, parcelaNumero?: number, parcelaTotal?: number, grupoParcelamentoId?: string) {
  return {
    descricao: req.descricao,
    tipo: req.tipo,
    valor,
    valorOriginal: req.valor, // as originally requested
    dataLancamento: req.dataLancamento,
    observacao: req.observacao || null,
    recorrente: req.recorrente || false,
    meioPagamento: req.meioPagamento || null,
    contaId: req.contaId,
    contaPagamentoId: req.contaPagamentoId || null,
    categoriaId: req.categoriaId,
    statusPagamento: req.statusPagamento || 'PENDENTE',
    dataVencimento: req.dataVencimento || null,
    diaRecorrenciaMensal: req.diaRecorrenciaMensal || null,
    dataAgendamentoPagamento: req.dataAgendamentoPagamento || null,
    dataPagamento: req.dataPagamento || null,
    compartilhada: !!req.divisoes?.length,
    grupoCompartilhamentoId: req.divisoes?.length ? newId() : null,
    parcelada,
    parcelaNumero: parcelaNumero || null,
    parcelaTotal: parcelaTotal || null,
    grupoParcelamentoId: grupoParcelamentoId || null,
    divisoes: mapDivisoes(req.divisoes, { id: perfilId, nome: 'Perfil' }), // Simplified for now
    perfilFinanceiroId: perfilId,
    ...auditCreate(uid)
  }
}

function mapDivisoes(divisoes: any[] | undefined, perfil: {id: string, nome: string}) {
  if (!divisoes) return []
  return divisoes.map(d => ({
    id: newId(),
    nome: d.nome || '',
    valor: d.valor || 0,
    percentual: d.percentual || null,
    perfilId: d.perfilId || perfil.id,
    perfilNome: d.perfilId ? d.perfilNome : perfil.nome
  }))
}

async function updateBalances(uid: string, data: any) {
  if (data.tipo === 'RECEITA') {
    await atualizarSaldoConta(uid, data.contaId, data.valor)
  } else if (data.tipo === 'DESPESA') {
    await atualizarSaldoConta(uid, data.contaId, -data.valor)
  } else if (data.tipo === 'TRANSFERENCIA') {
    await atualizarSaldoConta(uid, data.contaId, -data.valor)
    if (data.contaPagamentoId) {
      await atualizarSaldoConta(uid, data.contaPagamentoId, data.valor)
    }
  }
}

async function reverseBalances(uid: string, data: TransacaoDoc) {
  if (data.tipo === 'RECEITA') {
    await atualizarSaldoConta(uid, data.contaId, -data.valor)
  } else if (data.tipo === 'DESPESA') {
    await atualizarSaldoConta(uid, data.contaId, data.valor)
  } else if (data.tipo === 'TRANSFERENCIA') {
    await atualizarSaldoConta(uid, data.contaId, data.valor)
    if (data.contaPagamentoId) {
      await atualizarSaldoConta(uid, data.contaPagamentoId, -data.valor)
    }
  }
}
