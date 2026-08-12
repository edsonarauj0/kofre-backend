// Enums
export type TipoCategoria = 'DESPESA' | 'RECEITA' | 'TRANSFERENCIA' | 'INVESTIMENTO'
export type TipoDespesaCategoria = 'FIXA' | 'VARIAVEL'
export type TipoConta = 'CORRENTE' | 'POUPANCA' | 'INVESTIMENTO' | 'CARTEIRA' | 'CARTAO_CREDITO' | 'CRIPTO'
export type TipoTransacao = 'RECEITA' | 'DESPESA' | 'TRANSFERENCIA'
export type StatusPagamentoTransacao = 'PENDENTE' | 'AGENDADO' | 'PAGO'
export type Perfil = 'ADMIN' | 'USUARIO'

// Base entity
export interface EntidadeBase {
  id: string
  criadoEm: string
  atualizadoEm: string
  criadoPor: string
  excluido: boolean
}

// All domain entities with full fields from Java models
export interface Usuario extends EntidadeBase {
  nome: string
  email: string
  moedaPadrao: string
  fusoHorario: string
}

export interface PerfilFinanceiro extends EntidadeBase {
  nome: string
  padrao: boolean
}

export interface Conta extends EntidadeBase {
  nome: string
  tipo: TipoConta
  instituicao: string
  saldoAtual: number
  limiteCredito?: number
  diaFechamento?: number
  diaVencimento?: number
  perfilFinanceiroId: string
}

export interface Categoria extends EntidadeBase {
  nome: string
  cor: string
  icone: string
  tipo?: TipoCategoria
  grupo?: string
  ocultarRelatorios?: boolean
  tipoDespesa?: TipoDespesaCategoria
  perfilFinanceiroId: string
}

export interface TransacaoDivisao extends EntidadeBase {
  nome?: string
  valor?: number
  percentual?: number
  perfilId?: string
  perfilNome?: string
}

export interface Transacao extends EntidadeBase {
  descricao: string
  tipo: TipoTransacao
  valor: number
  valorOriginal: number
  dataLancamento: string
  observacao?: string
  recorrente: boolean
  meioPagamento?: string
  contaId: string
  contaPagamentoId?: string
  categoriaId: string
  statusPagamento: StatusPagamentoTransacao
  dataVencimento?: string
  diaRecorrenciaMensal?: number
  dataAgendamentoPagamento?: string
  dataPagamento?: string
  compartilhada: boolean
  grupoCompartilhamentoId?: string
  parcelada: boolean
  parcelaNumero?: number
  parcelaTotal?: number
  grupoParcelamentoId?: string
  divisoes: TransacaoDivisao[]
  perfilFinanceiroId: string
}

export type TransacaoDoc = Transacao

export interface ImportacaoFaturaCartao extends EntidadeBase {
  contaId: string
  referencia: string
  nomeArquivo?: string
  cartaoFinal?: string
  vencimento?: string
  totalFatura?: number
  totalProcessado: number
  valorTotalProcessado: number
}

export interface ImportacaoFaturaCartaoItem extends EntidadeBase {
  importacaoId: string
  descricao: string
  valor: number
  dataLancamento: string
  categoriaId?: string
  parcelaAtual?: number
  totalParcelas?: number
  observacao?: string
}

export interface TelegramConnectionToken extends EntidadeBase {
  token: string
  expiraEm: string
  comando: string
}

export interface TelegramSession extends EntidadeBase {
  sessaoAtiva: boolean
  sessaoExpiraEm?: string
  telegramChatId?: string
  telegramUserId?: string
}

export interface TelegramUserLink extends EntidadeBase {
  vinculado: boolean
}

// Request/Response DTOs
export interface CadastroRequest { nome: string; email: string; senha: string }
export interface UsuarioAutenticadoResponse { id: string; nome: string; email: string; moedaPadrao: string; fusoHorario: string }
export interface AtualizarPreferenciasRequest { moedaPadrao: string; fusoHorario: string }

export interface CategoriaRequest { nome: string; cor: string; icone: string; tipo?: TipoCategoria; grupo?: string; ocultarRelatorios?: boolean; tipoDespesa?: TipoDespesaCategoria }
export interface CategoriaResponse { id: string; nome: string; cor: string; icone: string; tipo?: string; grupo?: string; ocultarRelatorios?: boolean; tipoDespesa?: string }

export interface ContaRequest { nome: string; tipo: TipoConta; instituicao: string; saldoAtual: number; limiteCredito?: number; diaFechamento?: number; diaVencimento?: number }
export interface ContaUpdateRequest { nome: string; instituicao: string; saldoAtual: number; limiteCredito?: number; diaFechamento?: number; diaVencimento?: number }
export interface ContaResponse { id: string; nome: string; tipo: TipoConta; instituicao: string; saldoAtual: number; limiteCredito?: number; diaFechamento?: number; diaVencimento?: number }

export interface TransacaoDivisaoRequest { nome?: string; valor?: number; percentual?: number; perfilId?: string }
export interface TransacaoRequest { descricao: string; tipo: TipoTransacao; valor: number; dataLancamento: string; observacao?: string; recorrente?: boolean; meioPagamento?: string; contaId: string; categoriaId: string; quantidadeParcelas?: number; divisoes?: TransacaoDivisaoRequest[]; statusPagamento?: StatusPagamentoTransacao; dataVencimento?: string; dataAgendamentoPagamento?: string; dataPagamento?: string; contaPagamentoId?: string; diaRecorrenciaMensal?: number }
export interface TransacaoResponse { id: string; descricao: string; tipo: TipoTransacao; valor: number; valorOriginal: number; dataLancamento: string; observacao?: string; recorrente: boolean; meioPagamento?: string; contaId: string; contaPagamentoId?: string; categoriaId: string; statusPagamento: StatusPagamentoTransacao; dataVencimento?: string; diaRecorrenciaMensal?: number; dataAgendamentoPagamento?: string; dataPagamento?: string; compartilhada: boolean; grupoCompartilhamentoId?: string; parcelada: boolean; parcelaNumero?: number; parcelaTotal?: number; grupoParcelamentoId?: string; divisoes: TransacaoDivisaoResponse[] }
export interface TransacaoDivisaoResponse { id: string; nome: string; valor: number; percentual?: number; perfilId?: string; perfilNome?: string }
export interface StatusPagamentoUpdateRequest { statusPagamento: StatusPagamentoTransacao; dataAgendamentoPagamento?: string; dataPagamento?: string; contaPagamentoId?: string }

export interface PerfilFinanceiroRequest { nome: string }
export interface PerfilFinanceiroResponse { id: string; nome: string; padrao: boolean }

// Telegram DTOs
export interface TelegramConnectTokenResponse { token: string; expiraEm: string; comando: string }
export interface TelegramLinkStatusResponse { vinculado: boolean; sessaoAtiva: boolean; telegramChatIdMascarado?: string; telegramUserIdMascarado?: string; sessaoExpiraEm?: string; botUsername?: string; tokenConexao?: TelegramConnectTokenResponse }

// Fatura import DTOs
export interface ItemPreviewResponse { id: string; descricao: string; valor: number; dataLancamento: string; categoriaId?: string; categoriaNome?: string; categoriaNova?: boolean; grupoCategoria?: string; tipoDespesaCategoria?: string; parcelaAtual?: number; totalParcelas?: number; selecionado: boolean; observacao?: string }
export interface AnaliseFaturaResponse { contaId: string; contaNome: string; nomeArquivo: string; referencia: string; cartaoFinal?: string; vencimento?: string; totalFatura?: number; itens: ItemPreviewResponse[]; itensIgnorados: any[] }
export interface ItemProcessarRequest { id: string; descricao: string; valor: number; dataLancamento: string; categoriaId?: string; categoriaNome?: string; categoriaNova?: boolean; grupoCategoria?: string; tipoDespesaCategoria?: string; parcelaAtual?: number; totalParcelas?: number; divisoes?: TransacaoDivisaoRequest[]; selecionado?: boolean; observacao?: string }
export interface ProcessarFaturaRequest { contaId: string; referencia: string; nomeArquivo?: string; cartaoFinal?: string; vencimento?: string; totalFatura?: number; itens: ItemProcessarRequest[] }
export interface ProcessarFaturaResponse { contaId: string; contaNome: string; referencia: string; totalProcessado: number; valorTotalProcessado: number; categoriasCriadas: number; categoriasCriadasNomes: string[]; transacaoIdsCriadas: string[] }
