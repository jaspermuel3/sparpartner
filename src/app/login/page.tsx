import { LoginForm } from './LoginForm'
import { Sparkles, ShieldCheck, Zap, Clock3 } from 'lucide-react'
import Image from 'next/image'

export const metadata = { title: 'Anmelden · Sparpartner CRM' }

export default async function LoginPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 antialiased">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -left-40 top-20 h-96 w-96 rounded-full bg-sky-200/30 blur-3xl" />
        <div className="absolute -right-32 top-0 h-80 w-80 rounded-full bg-indigo-200/30 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-emerald-200/20 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-10 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between">
          <div className="inline-flex items-center gap-3">
            <Image
              src="/sparpartner-logo.svg"
              alt="Sparpartner24 Logo"
              width={44}
              height={44}
              className="h-11 w-11 drop-shadow-sm"
              priority
            />
            <div className="leading-tight">
              <div className="text-[15px] font-semibold tracking-tight">Sparpartner CRM</div>
              <div className="text-xs text-slate-500">Strom- &amp; Gasvertrieb</div>
            </div>
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white/60 px-3 py-1.5 text-[11px] font-medium text-slate-500 backdrop-blur sm:inline-flex">
            <Sparkles className="h-3 w-3 text-sky-600" />
            Version 2.0 · optimiert für Vertriebs-Teams
          </div>
        </header>

        <main className="flex flex-1 items-center justify-center py-10">
          <div className="grid w-full grid-cols-1 items-center gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
            <section className="w-full">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-3 py-1 text-[11px] font-medium text-slate-600 shadow-sm backdrop-blur">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                </span>
                System online · Alle Dienste erreichbar
              </div>

              <h1 className="mt-5 text-balance text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">
                Melde dich an und starte in deinen Vertriebs-Tag.
              </h1>
              <p className="mt-4 max-w-xl text-[15px] leading-7 text-slate-600">
                Interne Plattform für Vertriebspartner und Teamleitungen. Leads anfordern,
                Rückrufe planen, Abschlüsse verfolgen — zentral, schnell und tokenbasiert.
              </p>

              <dl className="mt-10 grid max-w-xl grid-cols-1 gap-4 sm:grid-cols-2">
                <FeatureCard
                  icon={<Zap className="h-4 w-4 stroke-[2]" />}
                  title="Race-Condition-sichere Lead-Vergabe"
                  description="FIFO-Queue, Skip-Locks, kein Lead geht doppelt raus."
                  iconClassName="bg-amber-50 text-amber-600"
                />
                <FeatureCard
                  icon={<ShieldCheck className="h-4 w-4 stroke-[2]" />}
                  title="Rollenbasierte Zugriffe"
                  description="Admin / Seller, RLS auf allen Tabellen + Storage."
                  iconClassName="bg-sky-50 text-sky-600"
                />
                <FeatureCard
                  icon={<Clock3 className="h-4 w-4 stroke-[2]" />}
                  title="Kalender & Rückruf-Tracker"
                  description="Nicht ein einziger Termin geht mehr verloren."
                  iconClassName="bg-violet-50 text-violet-600"
                />
                <FeatureCard
                  icon={<Sparkles className="h-4 w-4 stroke-[2]" />}
                  title="Kampagnen, Heatmaps, Funnel"
                  description="Auswertungen, die das Team wirklich weiterbringen."
                  iconClassName="bg-emerald-50 text-emerald-600"
                />
              </dl>
            </section>

            <section className="w-full">
              <div className="relative">
                <div
                  aria-hidden="true"
                  className="absolute -inset-2 rounded-[28px] bg-gradient-to-br from-sky-200/40 via-white to-indigo-200/30 blur-xl"
                />
                <div className="relative rounded-2xl border border-slate-200/80 bg-white/80 p-6 shadow-xl shadow-slate-900/5 backdrop-blur sm:p-8">
                  <div className="mb-6">
                    <h2 className="text-xl font-semibold tracking-tight text-slate-900">
                      Anmeldung
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Gib deine Zugangsdaten ein.
                    </p>
                  </div>
                  <LoginForm />
                </div>
              </div>
            </section>
          </div>
        </main>

        <footer className="mt-auto flex flex-col items-center justify-between gap-2 border-t border-slate-200/60 pt-5 text-[11px] text-slate-400 sm:flex-row">
          <p>© {new Date().getFullYear()} Sparpartner CRM · Interne Nutzung</p>
          <p className="text-slate-400/80">
            Fragen zum Zugriff? Wende dich an den Admin.
          </p>
        </footer>
      </div>
    </div>
  )
}

function FeatureCard({
  icon,
  title,
  description,
  iconClassName,
}: {
  icon: React.ReactNode
  title: string
  description: string
  iconClassName?: string
}) {
  return (
    <div className="group flex items-start gap-3 rounded-2xl border border-slate-200/70 bg-white/70 p-4 shadow-sm backdrop-blur transition-all hover:-translate-y-0.5 hover:border-slate-200 hover:bg-white hover:shadow-md">
      <div
        className={
          'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ' +
          (iconClassName ?? 'bg-slate-100 text-slate-600')
        }
        aria-hidden="true"
      >
        {icon}
      </div>
      <div className="min-w-0">
        <dt className="text-[13px] font-semibold leading-5 text-slate-900">
          {title}
        </dt>
        <dd className="mt-0.5 text-[12px] leading-5 text-slate-500">
          {description}
        </dd>
      </div>
    </div>
  )
}
