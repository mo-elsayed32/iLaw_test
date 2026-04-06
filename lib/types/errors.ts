export type ErrorCode =
  | 'DATA_LOAD_ERROR'
  | 'SEARCH_ERROR'
  | 'LLM_ERROR'
  | 'INVALID_REQUEST'
  | 'UNKNOWN_ERROR'

const USER_MESSAGES: Record<ErrorCode, string> = {
  DATA_LOAD_ERROR:
    'تعذّر تحميل قاعدة البيانات القانونية. يرجى المحاولة لاحقاً.',
  SEARCH_ERROR:
    'حدث خطأ أثناء البحث في النصوص القانونية. يرجى المحاولة مرة أخرى.',
  LLM_ERROR:
    'تعذّر الحصول على رد من المساعد القانوني. يرجى المحاولة بعد قليل.',
  INVALID_REQUEST:
    'الطلب غير صحيح. يرجى إعادة صياغة السؤال.',
  UNKNOWN_ERROR:
    'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.',
}

export class AppError extends Error {
  code: ErrorCode
  userMessage: string

  constructor(code: ErrorCode, internalMessage?: string) {
    super(internalMessage ?? code)
    this.code = code
    this.userMessage = USER_MESSAGES[code]
  }
}
