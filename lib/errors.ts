export class AppError extends Error {
  constructor(public message: string, public statusCode: number = 400) {
    super(message)
    this.name = 'AppError'
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Não autorizado') {
    super(message, 401)
    this.name = 'UnauthorizedError'
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Acesso negado') {
    super(message, 403)
    this.name = 'ForbiddenError'
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Recurso não encontrado') {
    super(message, 404)
    this.name = 'NotFoundError'
  }
}

export class BusinessRuleError extends AppError {
  constructor(message: string) {
    super(message, 422)
    this.name = 'BusinessRuleError'
  }
}

export function handleError(err: unknown): Response {
  if (err instanceof AppError) {
    return Response.json({ error: err.message }, { status: err.statusCode })
  }
  
  console.error('Unhandled error:', err)
  
  if (err instanceof Error) {
    return Response.json({ error: err.message || 'Erro interno do servidor' }, { status: 500 })
  }
  
  return Response.json({ error: 'Erro interno do servidor' }, { status: 500 })
}
