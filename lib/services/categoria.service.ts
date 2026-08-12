import { adminDb } from '../firebase/admin'
import { Categoria, CategoriaRequest } from '../../types'
import { auditCreate, auditUpdate, fromDoc, fromDocs, newId } from '../firestore/helpers'
import { BusinessRuleError, NotFoundError } from '../errors'
import { resolverPerfil } from './perfil-financeiro.service'

const COLLECTION = 'categorias'

function getCollectionRef(uid: string) {
  return adminDb.collection('usuarios').doc(uid).collection(COLLECTION)
}

export async function listarCategorias(uid: string, perfilId?: string | null): Promise<Categoria[]> {
  const perfil = await resolverPerfil(uid, perfilId)
  const snap = await getCollectionRef(uid)
    .where('excluido', '==', false)
    .where('perfilFinanceiroId', '==', perfil.id)
    .get()
  return fromDocs<Categoria>(snap.docs)
}

export async function criarCategoria(uid: string, perfilId: string | null | undefined, data: CategoriaRequest): Promise<Categoria> {
  const perfil = await resolverPerfil(uid, perfilId)
  const id = newId()
  const ref = getCollectionRef(uid).doc(id)
  
  const categoriaData = {
    nome: data.nome,
    cor: data.cor,
    icone: data.icone,
    tipo: data.tipo || 'DESPESA',
    grupo: data.grupo || null,
    ocultarRelatorios: data.ocultarRelatorios || false,
    tipoDespesa: data.tipoDespesa || null,
    perfilFinanceiroId: perfil.id,
    ...auditCreate(uid)
  }
  
  await ref.set(categoriaData)
  
  const doc = await ref.get()
  return fromDoc<Categoria>(doc)!
}

export async function atualizarCategoria(uid: string, perfilId: string | null | undefined, categoriaId: string, data: CategoriaRequest): Promise<Categoria> {
  const perfil = await resolverPerfil(uid, perfilId)
  const ref = getCollectionRef(uid).doc(categoriaId)
  const doc = await ref.get()
  
  if (!doc.exists) throw new NotFoundError('Categoria não encontrada')
  
  const categoria = fromDoc<Categoria>(doc)!
  if (categoria.perfilFinanceiroId !== perfil.id) throw new NotFoundError('Categoria não encontrada')
  
  await ref.update({
    nome: data.nome,
    cor: data.cor,
    icone: data.icone,
    tipo: data.tipo || categoria.tipo,
    grupo: data.grupo !== undefined ? data.grupo : categoria.grupo,
    ocultarRelatorios: data.ocultarRelatorios !== undefined ? data.ocultarRelatorios : categoria.ocultarRelatorios,
    tipoDespesa: data.tipoDespesa !== undefined ? data.tipoDespesa : categoria.tipoDespesa,
    ...auditUpdate()
  })
  
  const updatedDoc = await ref.get()
  return fromDoc<Categoria>(updatedDoc)!
}

export async function excluirCategoria(uid: string, perfilId: string | null | undefined, categoriaId: string): Promise<void> {
  const perfil = await resolverPerfil(uid, perfilId)
  const ref = getCollectionRef(uid).doc(categoriaId)
  const doc = await ref.get()
  
  if (!doc.exists) throw new NotFoundError('Categoria não encontrada')
  const categoria = fromDoc<Categoria>(doc)!
  if (categoria.perfilFinanceiroId !== perfil.id) throw new NotFoundError('Categoria não encontrada')
  
  // Business rule check if used in transactions (omitted exact query for brevity, assumed implementation pattern)
  const transacoes = await adminDb.collection('usuarios').doc(uid).collection('transacoes')
    .where('categoriaId', '==', categoriaId)
    .where('excluido', '==', false)
    .limit(1)
    .get()
    
  if (!transacoes.empty) {
    throw new BusinessRuleError('Categoria está em uso por transações e não pode ser excluída')
  }

  await ref.update({ excluido: true, ...auditUpdate() })
}

export async function atualizarGrupo(uid: string, perfilId: string | null | undefined, grupoAtual: string, novoGrupo: string): Promise<Categoria[]> {
  const perfil = await resolverPerfil(uid, perfilId)
  const snap = await getCollectionRef(uid)
    .where('grupo', '==', grupoAtual)
    .where('perfilFinanceiroId', '==', perfil.id)
    .where('excluido', '==', false)
    .get()
    
  const batch = adminDb.batch()
  const updated: Categoria[] = []
  
  for (const doc of snap.docs) {
    batch.update(doc.ref, { grupo: novoGrupo, ...auditUpdate() })
    updated.push({ ...doc.data(), id: doc.id, grupo: novoGrupo } as unknown as Categoria)
  }
  
  await batch.commit()
  return updated
}

export async function atualizarVisibilidadeGrupo(uid: string, perfilId: string | null | undefined, grupoAtual: string, ocultarRelatorios: boolean): Promise<Categoria[]> {
  const perfil = await resolverPerfil(uid, perfilId)
  const snap = await getCollectionRef(uid)
    .where('grupo', '==', grupoAtual)
    .where('perfilFinanceiroId', '==', perfil.id)
    .where('excluido', '==', false)
    .get()
    
  const batch = adminDb.batch()
  const updated: Categoria[] = []
  
  for (const doc of snap.docs) {
    batch.update(doc.ref, { ocultarRelatorios, ...auditUpdate() })
    updated.push({ ...doc.data(), id: doc.id, ocultarRelatorios } as unknown as Categoria)
  }
  
  await batch.commit()
  return updated
}

export async function excluirGrupo(uid: string, perfilId: string | null | undefined, grupoAtual: string): Promise<void> {
  const perfil = await resolverPerfil(uid, perfilId)
  const snap = await getCollectionRef(uid)
    .where('grupo', '==', grupoAtual)
    .where('perfilFinanceiroId', '==', perfil.id)
    .where('excluido', '==', false)
    .get()
    
  if (snap.empty) throw new NotFoundError('Grupo não encontrado')
  
  for (const doc of snap.docs) {
    const categoriaId = doc.id
    const transacoes = await adminDb.collection('usuarios').doc(uid).collection('transacoes')
      .where('categoriaId', '==', categoriaId)
      .where('excluido', '==', false)
      .limit(1)
      .get()
      
    if (!transacoes.empty) {
      throw new BusinessRuleError('Uma ou mais categorias do grupo estão em uso por transações')
    }
  }

  const batch = adminDb.batch()
  for (const doc of snap.docs) {
    batch.update(doc.ref, { excluido: true, ...auditUpdate() })
  }
  await batch.commit()
}
