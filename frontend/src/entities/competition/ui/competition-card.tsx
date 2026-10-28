import type { ReactNode } from 'react'
import { routes } from '@/shared/config'
import { cn, disciplineIconName, formatNumber } from '@/shared/lib'
import {
  Card,
  DisciplineIcon,
  IconCalendar,
  IconMapPin,
  IconTrophy,
  KindTag,
  MetaTag,
  StatusTag,
  VerifiedMark,
  type StatusTone,
} from '@/shared/ui'
import { competitionDates } from '../lib/dates'
import { competitionPlace, isOnlineFormat } from '../lib/describe'
import type { CompetitionSummary } from '../model/types'

/** Всё, что нужно карточке: из каталога, кабинета и ленты календаря приходит в разной форме */
export interface CompetitionCardData {
  id: number
  title: string
  status: string
  status_title: string
  is_verified: boolean
  discipline: string | null
  starts_on: string
  ends_on: string
  place: string | null
  is_online: boolean
  groups: string[]
  prize?: string | null
}

const tones: Record<string, StatusTone> = {
  draft: 'draft',
  published: 'active',
  registration_open: 'active',
  registration_closed: 'done',
  in_progress: 'live',
  completed: 'done',
  archived: 'done',
  cancelled: 'cancelled',
}

const fromSummary = (competition: CompetitionSummary): CompetitionCardData => ({
  id: competition.id,
  title: competition.title,
  status: competition.status,
  status_title: competition.status_title,
  is_verified: competition.is_verified,
  discipline: competition.discipline.name,
  starts_on: competition.starts_on,
  ends_on: competition.ends_on,
  place: competitionPlace(competition) || null,
  is_online: isOnlineFormat(competition.contest_format.name),
  groups: [...competition.age_groups, ...competition.academic_groups].map((group) => group.name),
  prize:
    competition.prize_fund_amount != null
      ? `${formatNumber(competition.prize_fund_amount)}\u00a0₽`
      : competition.prize_fund_text,
})

/**
 * Карточка соревнования — одна на всей платформе: главная, каталог, календарь, кабинет.
 * Сверху полоса с дисциплиной на сетке и форматом, ниже статус, название со щитом, даты и место, группы.
 * Вся карточка — ссылка; в кабинете вместо ссылки снизу встают действия (footer).
 */
export function CompetitionCard({
  competition,
  showKind = false,
  highlight,
  verification,
  extra,
  footer,
  className,
}: {
  competition: CompetitionSummary | CompetitionCardData
  /** Метка «Соревнование» — там, где рядом бывают события (календарь) */
  showKind?: boolean
  /** Красная метка вместо статуса: «Ближайшее» */
  highlight?: string
  /** Щит в кабинете: состояние заявки на верификацию; на сайте — только у верифицированных */
  verification?: ReactNode
  /** Строки кабинета: статус заявки, организатор, причины отказа и отмены */
  extra?: ReactNode
  footer?: ReactNode
  className?: string
}) {
  const item = 'contest_format' in competition ? fromSummary(competition) : competition
  const quietStatus = item.status === 'published' || item.status === 'registration_open'

  return (
    <Card
      to={footer ? undefined : routes.competition(item.id)}
      padding="none"
      className={cn('flex h-full flex-col overflow-hidden', className)}
    >
      <div className="grid-texture flex items-center gap-3 border-b border-line-soft px-5 py-3">
        <DisciplineIcon name={disciplineIconName(item.discipline)} className="size-7 shrink-0" />
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted">
          {showKind ? <KindTag kind="contest" /> : item.discipline}
        </span>
        <MetaTag accent={item.is_online}>{item.is_online ? 'Онлайн' : 'Оффлайн'}</MetaTag>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-5">
        {(highlight || !quietStatus) && (
          <StatusTag tone={highlight ? 'live' : (tones[item.status] ?? 'active')}>
            {highlight ?? item.status_title}
          </StatusTag>
        )}
        {highlight && !quietStatus && <span className="sr-only">{item.status_title}</span>}

        <h3 className="flex items-start gap-2 text-h3 font-medium text-balance break-words">
          <span className="min-w-0 flex-1">{item.title}</span>
          {verification ?? (item.is_verified && <VerifiedMark className="mt-0.5" />)}
        </h3>

        <div className="mt-auto flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
          <span className="inline-flex items-center gap-1.5">
            <IconCalendar size={16} className="shrink-0" />
            {competitionDates(item)}
          </span>
          {item.place && (
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <IconMapPin size={16} className="shrink-0" />
              <span className="truncate">{item.place}</span>
            </span>
          )}
          {item.prize && (
            <span className="inline-flex items-center gap-1.5 text-ink">
              <IconTrophy size={16} className="shrink-0" />
              {item.prize}
            </span>
          )}
        </div>

        {item.groups.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {item.groups.map((group) => (
              <MetaTag key={group}>{group}</MetaTag>
            ))}
          </div>
        )}

        {extra}

        {footer && <div className="border-t border-line-soft pt-4">{footer}</div>}
      </div>
    </Card>
  )
}
