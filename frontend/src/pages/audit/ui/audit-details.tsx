import { Fragment } from 'react'
import { applicationStatusTitles } from '@/entities/application'
import {
  auditChanges,
  auditDetails,
  auditFieldLabel,
  auditObjectLink,
  formatAuditValue,
  type AuditEntry,
} from '@/entities/audit'
import { statusTitles, verificationTitles } from '@/entities/competition'
import { roleLabels, roleStatusLabels } from '@/entities/session'
import { Button } from '@/shared/ui'

const statusMaps: [prefix: string, titles: Record<string, string>][] = [
  ['contest.verification', verificationTitles],
  ['contest.', statusTitles],
  ['application.', applicationStatusTitles],
  ['role.', roleStatusLabels],
]

/** Код статуса → подпись по области действия: «draft» у соревнования — «Черновик» */
function statusTitle(action: string, value: unknown) {
  const code = formatAuditValue(value)
  const titles = statusMaps.find(([prefix]) => action.startsWith(prefix))?.[1]
  return titles?.[code] ?? code
}

/** Подробности записи журнала: что изменилось, статус, причина, служебные поля и ссылки */
export function AuditDetails({ entry, onUser }: { entry: AuditEntry; onUser: (id: string) => void }) {
  const changes = auditChanges(entry)
  const rest = auditDetails(entry)
  const { from, to, reason } = entry.payload
  const link = auditObjectLink(entry)
  const user = entry.user
  return (
    <div className="flex min-w-0 flex-col gap-4">
      {changes.length > 0 && (
        // Не таблица: в узкой колонке три столбца рвут слова. Поле слева (на телефоне сверху), справа «было» и «стало»
        <ul
          aria-label="Изменения"
          className="divide-y divide-line-soft rounded-md border border-line-soft text-sm"
        >
          {changes.map((row) => (
            <li key={row.field} className="grid gap-1 px-3 py-2.5 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-3">
              <span className="text-muted">{row.label}</span>
              <span className="flex min-w-0 flex-col gap-1 break-words">
                <span className="text-muted">
                  <span className="mr-2 font-mono text-xs">было</span>
                  {formatAuditValue(row.old)}
                </span>
                <span className="text-ink">
                  <span className="mr-2 font-mono text-xs text-muted">стало</span>
                  {formatAuditValue(row.new)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {(from !== undefined || to !== undefined) && (
        <p className="text-sm text-ink">
          Статус: {from !== undefined ? statusTitle(entry.action, from) : '—'}
          {to !== undefined && <> → {statusTitle(entry.action, to)}</>}
        </p>
      )}
      {typeof reason === 'string' && reason && (
        <p className="text-sm [overflow-wrap:anywhere] text-ink">Причина: {reason}</p>
      )}
      {rest.length > 0 && (
        <dl className="grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[11rem_minmax(0,1fr)]">
          {rest.map(([key, value]) => (
            <Fragment key={key}>
              <dt className="text-muted">{auditFieldLabel(key)}</dt>
              <dd className="font-mono text-xs break-all text-ink sm:pt-0.5">
                {key === 'role' && typeof value === 'string'
                  ? ((roleLabels as Record<string, string>)[value] ?? value)
                  : key === 'previous'
                    ? statusTitle(entry.action, value)
                    : formatAuditValue(value)}
              </dd>
            </Fragment>
          ))}
        </dl>
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted">
        {user && <span className="[overflow-wrap:anywhere]">{user.email}</span>}
        {entry.ip && <span className="font-mono">IP {entry.ip}</span>}
        <span className="font-mono">{entry.action}</span>
      </div>
      {(user || link) && (
        <div className="flex flex-wrap gap-2">
          {link && (
            <Button variant="secondary" size="sm" to={link}>
              Открыть
            </Button>
          )}
          {user && (
            <Button variant="ghost" size="sm" onClick={() => onUser(user.id)}>
              Все действия пользователя
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
