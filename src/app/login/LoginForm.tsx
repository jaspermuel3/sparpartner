'use client'

import { Suspense, useEffect, useMemo, useState, useTransition } from 'react'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { useSearchParams } from 'next/navigation'

function LoginFormInner() {
  const searchParams = useSearchParams()
  const next = searchParams.get('next')?.startsWith('/') ? searchParams.get('next')! : '/dashboard'
  const errorParam = searchParams.get('error') ?? null
  const prefilledEmail = searchParams.get('email') ?? ''

  const [showPassword, setShowPassword] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [email, setEmail] = useState<string>(prefilledEmail)
  const [password, setPassword] = useState<string>('')
  const [localError, setLocalError] = useState<string | null>(null)

  const errorText = useMemo(() => {
    if (localError) return localError
    if (errorParam === 'inactive') {
      return 'Dein Account ist deaktiviert. Bitte kontaktiere den Administrator.'
    }
    if (errorParam && errorParam.length > 3) {
      try {
        return decodeURIComponent(errorParam)
      } catch {
        return errorParam
      }
    }
    return null
  }, [errorParam, localError])

  useEffect(() => {
    setLocalError(null)
  }, [email, password])

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const form = event.currentTarget
    const formData = new FormData(form)
    const e = String(formData.get('email') ?? '').trim()
    const p = String(formData.get('password') ?? '')
    if (!e || !p) {
      event.preventDefault()
      setLocalError('Bitte E-Mail und Passwort eingeben.')
      return
    }
    setLocalError(null)
    startTransition(() => {})
  }

  return (
    <div className="space-y-6">
      <form
        method="POST"
        action="/api/auth/login"
        onSubmit={handleSubmit}
        className="w-full space-y-5"
      >
        <input type="hidden" name="next" value={next} />

        <div className="space-y-1.5">
          <label htmlFor="email" className="text-sm font-medium text-slate-700">
            E-Mail
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            autoComplete="email"
            inputMode="email"
            placeholder="name@unternehmen.de"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={
              'flex min-h-[44px] w-full rounded-xl border bg-white px-3.5 text-[15px] leading-6 ' +
              'text-slate-900 placeholder:text-slate-400 shadow-sm outline-none transition-all ' +
              'focus-visible:ring-2 focus-visible:ring-offset-0 ' +
              (errorText
                ? 'border-red-300 focus-visible:border-red-400 focus-visible:ring-red-900/20'
                : 'border-slate-200 focus-visible:border-slate-400 focus-visible:ring-slate-900/10')
            }
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="text-sm font-medium text-slate-700">
              Passwort
            </label>
          </div>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete="current-password"
              spellCheck={false}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={
                'flex min-h-[44px] w-full rounded-xl border bg-white pr-12 pl-3.5 text-[15px] leading-6 ' +
                'text-slate-900 placeholder:text-slate-400 shadow-sm outline-none transition-all ' +
                'focus-visible:ring-2 focus-visible:ring-offset-0 ' +
                (errorText
                  ? 'border-red-300 focus-visible:border-red-400 focus-visible:ring-red-900/20'
                  : 'border-slate-200 focus-visible:border-slate-400 focus-visible:ring-slate-900/10')
              }
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Passwort verbergen' : 'Passwort anzeigen'}
              className="absolute inset-y-0 right-0 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-r-xl text-slate-500 transition-colors hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/10"
            >
              {showPassword ? (
                <EyeOff className="h-[18px] w-[18px] stroke-[1.75]" />
              ) : (
                <Eye className="h-[18px] w-[18px] stroke-[1.75]" />
              )}
            </button>
          </div>
        </div>

        {errorText && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700 animate-in fade-in-0 slide-in-from-top-2"
          >
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              className="mt-0.5 h-4 w-4 shrink-0 text-red-600"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M18 10A8 8 0 1 1 2 10a8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 8.25a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Z"
                clipRule="evenodd"
              />
            </svg>
            <div className="leading-5">{errorText}</div>
          </div>
        )}

        <button
          type="submit"
          disabled={isPending}
          className={
            'group relative inline-flex min-h-[44px] w-full items-center justify-center gap-2 overflow-hidden rounded-xl px-4 py-2.5 ' +
            'text-[15px] font-semibold text-white shadow-sm transition-all ' +
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 ' +
            'active:scale-[0.995] disabled:pointer-events-none disabled:opacity-60 ' +
            'bg-slate-900 hover:bg-slate-800'
          }
        >
          <span
            className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 group-hover:translate-x-full"
            aria-hidden="true"
          />
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Anmelden…</span>
            </>
          ) : (
            <span>Anmelden</span>
          )}
        </button>
      </form>

      <div className="border-t border-slate-200/70 pt-4">
        <p className="text-center text-[11px] leading-relaxed text-slate-400">
          Gib deine Zugangsdaten ein. Bei Problemen wende dich an deinen Administrator.
        </p>
      </div>
    </div>
  )
}

export function LoginForm() {
  return (
    <Suspense
      fallback={
        <div className="space-y-5">
          <div className="h-[88px] space-y-1.5">
            <div className="h-4 w-14 rounded bg-slate-100 animate-pulse" />
            <div className="min-h-[44px] w-full rounded-xl bg-slate-100 animate-pulse" />
          </div>
          <div className="h-[88px] space-y-1.5">
            <div className="h-4 w-16 rounded bg-slate-100 animate-pulse" />
            <div className="min-h-[44px] w-full rounded-xl bg-slate-100 animate-pulse" />
          </div>
          <div className="min-h-[44px] w-full rounded-xl bg-slate-100 animate-pulse" />
        </div>
      }
    >
      <LoginFormInner />
    </Suspense>
  )
}
