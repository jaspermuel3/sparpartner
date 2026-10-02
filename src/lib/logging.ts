import { isDev, isProd } from './env'

export type LogContext = Record<string, unknown>

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

function formatCtx(ctx?: LogContext): string {
  if (!ctx || Object.keys(ctx).length === 0) return ''
  try {
    return ' ' + JSON.stringify(ctx)
  } catch {
    return ' [context-serialization-failed]'
  }
}

function write(level: LogLevel, tag: string, message: string, ctx?: LogContext, err?: unknown) {
  const ts = new Date().toISOString()
  const prefix = `[${ts}] [${level.toUpperCase()}] [${tag}]`
  const body = `${prefix}: ${message}${formatCtx(ctx)}`

  if (level === 'error' || level === 'warn') {
    if (err instanceof Error) {
      // eslint-disable-next-line no-console
      console.error(body + formatCtx({ errMsg: err.message, errStack: err.stack }))
    } else if (err != null) {
      // eslint-disable-next-line no-console
      console.error(body + formatCtx({ err }))
    } else {
      // eslint-disable-next-line no-console
      console.error(body)
    }
    return
  }

  if (level === 'info') {
    // eslint-disable-next-line no-console
    console.info(body)
    return
  }

  if (isDev()) {
    // eslint-disable-next-line no-console
    console.debug(body)
  }
}

export const log = {
  debug(tag: string, msg: string, ctx?: LogContext) {
    write('debug', tag, msg, ctx)
  },
  info(tag: string, msg: string, ctx?: LogContext) {
    write('info', tag, msg, ctx)
  },
  warn(tag: string, msg: string, ctx?: LogContext, err?: unknown) {
    write('warn', tag, msg, ctx, err)
  },
  error(tag: string, msg: string, ctx?: LogContext, err?: unknown) {
    write('error', tag, msg, ctx, err)
  },
}

/**
 * Silent-Fail Wrapper für "nice-to-have" Operationen.
 * Fehler werden geloggt, aber nicht weiter geworfen.
 * Beispiel: logAudit darf den Hauptflow nicht abbrechen.
 */
export async function tryLog<T>(
  tag: string,
  fallback: T,
  fn: () => T | Promise<T>,
  msg = 'Operation fehlgeschlagen (swallowed)',
): Promise<T> {
  try {
    return await fn()
  } catch (e) {
    log.warn(tag, msg, undefined, e)
    return fallback
  }
}
