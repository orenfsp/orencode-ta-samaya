import type { ReactNode } from 'react'
import { cn, encodeQr } from '@/shared/lib'
import { BrandLogo } from './brand-logo'

/**
 * QR-код из своего кодировщика (shared/lib/qr.ts), без библиотек. Тёмные модули на белом —
 * иначе камеры читают плохо, поэтому подложка белая в любой теме. Тихая зона — 4 модуля.
 */
export function QrCode({
  value,
  size = 128,
  className,
}: {
  value: string
  size?: number
  className?: string
}) {
  const modules = encodeQr(value)
  const count = modules.length + 8
  const path = modules
    .flatMap((row, y) => row.map((dark, x) => (dark ? `M${x + 4} ${y + 4}h1v1h-1z` : '')))
    .join('')
  return (
    <svg
      role="img"
      aria-label={`QR-код: ${value}`}
      viewBox={`0 0 ${count} ${count}`}
      width={size}
      height={size}
      shapeRendering="crispEdges"
      className={cn('shrink-0 rounded-sm bg-white', className)}
    >
      <path d={path} fill="var(--fsp-ink)" />
    </svg>
  )
}

/**
 * Лист документа: приказ о сборной, справка об участии, протокол. Всегда «бумага» —
 * светлые токены внутри (data-theme="light") в любой теме сайта; при печати остаётся только он.
 * Справка проверяется по QR: код ведёт на эту же веб-страницу на сайте федерации.
 */
export function DocumentSheet({
  kind,
  number,
  date,
  title,
  verifyUrl,
  signatures,
  children,
  className,
}: {
  /** «Приказ», «Справка» */
  kind: string
  number?: string
  date: string
  title: ReactNode
  /** Ссылка проверки подлинности — рисуется QR-кодом в шапке */
  verifyUrl?: string
  signatures?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <article
      data-theme="light"
      className={cn(
        'document-sheet mx-auto flex w-full max-w-[52rem] flex-col gap-8 rounded-lg bg-white px-6 py-8 text-ink shadow-layer sm:px-14 sm:py-12',
        className,
      )}
    >
      <header className="flex items-start justify-between gap-6 border-b border-line pb-6">
        <div className="flex flex-col gap-3">
          <BrandLogo className="h-9" />
          <p className="max-w-xs text-xs text-muted">
            Региональное отделение Федерации спортивного программирования Оренбургской области
          </p>
        </div>
        {verifyUrl && (
          <div className="flex flex-col items-center gap-1">
            <QrCode value={verifyUrl} size={96} />
            <span className="text-[0.625rem] text-muted">проверка подлинности</span>
          </div>
        )}
      </header>
      <div className="flex flex-col gap-1">
        <p className="font-mono text-sm text-muted">
          {kind}
          {number && ` № ${number}`} · {date}
        </p>
        <h1 className="text-h2 font-medium text-balance">{title}</h1>
      </div>
      <div className="flex flex-col gap-4 text-body leading-relaxed [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6">
        {children}
      </div>
      {signatures && <footer className="mt-4 flex flex-col gap-6">{signatures}</footer>}
    </article>
  )
}

/** Строка подписи: должность слева, линия, расшифровка справа */
export function SignatureLine({ role, name }: { role: string; name: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_8rem_auto] items-end gap-4 text-sm">
      <span className="text-ink">{role}</span>
      <span className="border-b border-ink" aria-hidden="true" />
      <span className="text-ink">{name}</span>
    </div>
  )
}
