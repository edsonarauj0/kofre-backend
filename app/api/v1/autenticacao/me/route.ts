export const dynamic = 'force-dynamic'

// Rota espelho de /api/autenticacao/me para compatibilidade com frontend
// que usa baseURL /api/v1 (axios)
export { GET, PUT } from '@/app/api/autenticacao/me/route'
