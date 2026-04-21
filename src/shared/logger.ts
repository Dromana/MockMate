type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const isDev = typeof process !== 'undefined' && process.env.NODE_ENV !== 'production'

function log(level: LogLevel, context: string, message: string, ...args: unknown[]) {
  if (level === 'debug' && !isDev) return
  const prefix = `[MockMate:${context}]`
  console[level](prefix, message, ...args)
}

export function createLogger(context: string) {
  return {
    debug: (msg: string, ...args: unknown[]) => log('debug', context, msg, ...args),
    info: (msg: string, ...args: unknown[]) => log('info', context, msg, ...args),
    warn: (msg: string, ...args: unknown[]) => log('warn', context, msg, ...args),
    error: (msg: string, ...args: unknown[]) => log('error', context, msg, ...args),
  }
}
