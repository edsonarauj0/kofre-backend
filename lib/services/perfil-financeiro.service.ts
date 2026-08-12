import { adminDb } from '../firebase/admin'
import { PerfilFinanceiro } from '../../types'
import { auditCreate, auditUpdate, fromDoc, fromDocs, newId } from '../firestore/helpers'
import { BusinessRuleError, NotFoundError } from '../errors'

const COLLECTION = 'perfis_financeiros'
const usuariosRef = adminDb.collection('usuarios')

function getCollectionRef(uid: string) {
  return usuariosRef.doc(uid).collection(COLLECTION)
}

export async function listarPerfis(uid: string): Promise<PerfilFinanceiro[]> {
  const snap = await getCollectionRef(uid).where('excluido', '==', false).get()
  return fromDocs<PerfilFinanceiro>(snap.docs)
}

export async function criarPerfil(uid: string, nome: string): Promise<PerfilFinanceiro> {
  const ref = getCollectionRef(uid)
  
  // check duplicate
  const all = await listarPerfis(uid)
  if (all.some(p => p.nome.toLowerCase() === nome.toLowerCase())) {
    throw new BusinessRuleError('Já existe um perfil com este nome')
  }

  const id = newId()
  const docRef = ref.doc(id)
  
  const data = {
    nome,
    padrao: all.length === 0,
    ...auditCreate(uid)
  }
  
  await docRef.set(data)
  
  const doc = await docRef.get()
  return fromDoc<PerfilFinanceiro>(doc)!
}

export async function excluirPerfil(uid: string, perfilId: string): Promise<void> {
  const ref = getCollectionRef(uid).doc(perfilId)
  const doc = await ref.get()
  
  if (!doc.exists) throw new NotFoundError('Perfil não encontrado')
  
  const perfil = fromDoc<PerfilFinanceiro>(doc)!
  if (perfil.padrao) {
    throw new BusinessRuleError('Não é possível excluir o perfil padrão')
  }
  
  await ref.update({ excluido: true, ...auditUpdate() })
}

export async function inicializarPerfilPadrao(uid: string, nomeUsuario: string): Promise<PerfilFinanceiro> {
  const all = await listarPerfis(uid)
  if (all.some(p => p.padrao)) {
    return all.find(p => p.padrao)!
  }
  
  const nome = 'Personal'
  return criarPerfil(uid, nome)
}

export async function resolverPerfil(uid: string, perfilId?: string | null): Promise<PerfilFinanceiro> {
  const all = await listarPerfis(uid)
  
  if (perfilId) {
    const p = all.find(x => x.id === perfilId)
    if (!p) throw new NotFoundError('Perfil financeiro não encontrado')
    return p
  }
  
  const p = all.find(x => x.padrao)
  if (p) return p
  
  // fallback if no default exists somehow
  if (all.length > 0) return all[0]
  
  throw new BusinessRuleError('Usuário não possui perfil financeiro')
}
