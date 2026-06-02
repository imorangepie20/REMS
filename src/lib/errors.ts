export class AuthError extends Error {
  constructor(message = '로그인이 필요합니다') {
    super(message)
    this.name = 'AuthError'
  }
}

export class ForbiddenError extends Error {
  constructor(message = '권한이 없습니다') {
    super(message)
    this.name = 'ForbiddenError'
  }
}

export class ConflictError extends Error {
  constructor(message = '이미 존재합니다') {
    super(message)
    this.name = 'ConflictError'
  }
}

export class NotFoundError extends Error {
  constructor(message = '찾을 수 없습니다') {
    super(message)
    this.name = 'NotFoundError'
  }
}
