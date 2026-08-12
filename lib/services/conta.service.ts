import { adminDb } from '../firebase/admin'
import { Conta, ContaRequest, ContaUpdateRequest } from '../../types'
import { auditCreate, auditUpdate, fromDoc, fromDocs, newId } from '../firestore/helpers'
import { BusinessRuleError, NotFoundError } from '../errors'
import { resolverPerfil } from './perfil-financeiro.service'

const COLLECTION = 'contas'

function getCollectionRef(uid: string) {
  return adminDb.collection('usuarios').doc(uid).collection(COLLECTION)
}

export async function listarContas(uid: string, perfilId?: string | null): Promise<Conta[]> {
  const perfil = await resolverPerfil(uid, perfilId)
  const snap = await getCollectionRef(uid)
    .where('excluido', '==', false)
    .where('perfilFinanceiroId', '==', perfil.id)
    .get()
  return fromDocs<Conta>(snap.docs)
}

export async function criarConta(uid: string, perfilId: string | null | undefined, data: ContaRequest): Promise<Conta> {
  const perfil = await resolverPerfil(uid, perfilId)
  const id = newId()
  const ref = getCollectionRef(uid).doc(id)
  
  const contaData = {
    nome: data.nome,
    tipo: data.tipo,
    instituicao: data.instituicao,
    saldoAtual: data.saldoAtual || 0,
    limiteCredito: data.limiteCredito || null,
    diaFechamento: data.diaFechamento || null,
    diaVencimento: data.diaVencimento || null,
    perfilFinanceiroId: perfil.id,
    ...auditCreate(uid)
  }
  
  await ref.set(contaData)
  
  const doc = await ref.get()
  return fromDoc<Conta>(doc)!
}

export async function atualizarConta(uid: string, perfilId: string | null | undefined, contaId: string, data: ContaUpdateRequest): Promise<Conta> {
  const perfil = await resolverPerfil(uid, perfilId)
  const ref = getCollectionRef(uid).doc(contaId)
  const doc = await ref.get()
  
  if (!doc.exists) throw new NotFoundError('Conta não encontrada')
  const conta = fromDoc<Conta>(doc)!
  if (conta.perfilFinanceiroId !== perfil.id) throw new NotFoundError('Conta não encontrada')
  
  await ref.update({
    nome: data.nome,
    instituicao: data.instituicao,
    saldoAtual: data.saldoAtual,
    limiteCredito: data.limiteCredito !== undefined ? data.limiteCredito : conta.limiteCredito,
    diaFechamento: data.diaFechamento !== undefined ? data.diaFechamento : conta.diaFechamento,
    diaVencimento: data.diaVencimento !== undefined ? data.diaVencimento : conta.diaVencimento,
    ...auditUpdate()
  })
  
  const updatedDoc = await ref.get()
  return fromDoc<Conta>(updatedDoc)!
}

export async function excluirConta(uid: string, perfilId: string | null | undefined, contaId: string): Promise<void> {
  const perfil = await resolverPerfil(uid, perfilId)
  const ref = getCollectionRef(uid).doc(contaId)
  const doc = await ref.get()
  
  if (!doc.exists) throw new NotFoundError('Conta não encontrada')
  const conta = fromDoc<Conta>(doc)!
  if (conta.perfilFinanceiroId !== perfil.id) throw new NotFoundError('Conta não encontrada')
  
  const transacoes = await adminDb.collection('usuarios').doc(uid).collection('transacoes')
    .where('contaId', '==', contaId)
    .where('excluido', '==', false)
    .limit(1)
    .get()
    
  if (!transacoes.empty) {
    throw new BusinessRuleError('Conta não pode ser excluída pois possui transações vinculadas')
  }

  await ref.update({ excluido: true, ...auditUpdate() })
}

export async function atualizarSaldoConta(uid: string, contaId: string, delta: number): Promise<void> {
  if (delta === 0) return
  const ref = getCollectionRef(uid).doc(contaId)
  await adminDb.runTransaction(async t => {
    const doc = await t.get(ref)
    if (!doc.exists) throw new NotFoundError('Conta não encontrada')
    const atual = doc.data()?.saldoAtual || 0
    t.update(ref, { saldoAtual: atual + delta, ...auditUpdate() })
  })
}

export async function recalcularSaldo(uid: string, perfilId: string | null | undefined, contaId: string): Promise<Conta> {
  const perfil = await resolverPerfil(uid, perfilId)
  const ref = getCollectionRef(uid).doc(contaId)
  const doc = await ref.get()
  if (!doc.exists) throw new NotFoundError('Conta não encontrada')
  const conta = fromDoc<Conta>(doc)!
  if (conta.perfilFinanceiroId !== perfil.id) throw new NotFoundError('Conta não encontrada')

  const transacoesRef = adminDb.collection('usuarios').doc(uid).collection('transacoes')
  const [origem, destino] = await Promise.all([
    transacoesRef.where('contaId', '==', contaId).where('excluido', '==', false).get(),
    transacoesRef.where('contaPagamentoId', '==', contaId).where('excluido', '==', false).get()
  ])

  let saldo = 0
  for (const t of origem.docs) {
    const data = t.data()
    if (data.tipo === 'RECEITA') saldo += data.valor
    else if (data.tipo === 'DESPESA' || data.tipo === 'TRANSFERENCIA') saldo -= data.valor
  }
  for (const t of destino.docs) {
    const data = t.data()
    if (data.tipo === 'TRANSFERENCIA') saldo += data.valor
  }

  await ref.update({ saldoAtual: saldo, ...auditUpdate() })
  
  const updatedDoc = await ref.get()
  return fromDoc<Conta>(updatedDoc)!
}
