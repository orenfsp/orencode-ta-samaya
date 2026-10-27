import type { ReactNode } from 'react'
import { routes } from '@/shared/config'
import { cn, formatNumber } from '@/shared/lib'
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
} from '@/shared/ui'
import { competitionDates } from '../lib/dates'
import { competitionPlace, isOnlineFormat, statusTone } from '../lib/describe'
import type { CompetitionSummary } from '../model/types'
import { PhotoCarousel } from './photo-carousel'

/**
 * Карточка соревнования — одна на сайте и в кабинете. Порядок всегда один:
 * вид и статус → название со щитом верификации → даты и место → дисциплина и возраст → приз → действия.
 * Ссылка на страницу — у карточки целиком; в кабинете вместо ссылки снизу встают действия (footer).
 */
export function CompetitionCard({
  competition,
  showKind = false,
  verification,
  extra,
  footer,
  className,
}: {
  competition: CompetitionSummary
  /** Метка «Соревнование» — там, где рядом бывают события (календарь) */
  showKind?: boolean
  /** Щит в кабинете: состояние заявки на верификацию; на сайте — только у верифицированных */
  verification?: ReactNode
  /** Дополнительные строки: организатор, причины отказа и отмены */
  extra?: ReactNode
  footer?: ReactNode
  className?: string
}) {
  const online = isOnlineFormat(competition.contest_format.name)
  const place = competitionPlace(competition)
  const groups = [...competition.age_groups, ...competition.academic_groups]
  const prize =
    competition.prize_fund_amount != null
      ? `${formatNumber(competition.prize_fund_amount)}\u00a0₽`
      : competition.prize_fund_text

  return (
    <Card
      to={footer ? undefined : routes.competition(competition.id)}
      padding="none"
      className={cn('flex h-full flex-col overflow-hidden', className)}
    >
      <PhotoCarousel
        photos={competition.photos}
        title={competition.title}
        className="rounded-none"
        fallback={
          <div className="grid-texture flex aspect-[16/7] items-end justify-between gap-3 border-b border-line-soft p-5">
            <DisciplineIcon name={disciplineIcon(competition.discipline.name)} className="size-10" />
            <span className="text-right font-mono text-xs text-muted">{competition.discipline.name}</span>
          </div>
        }
      />

      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <div className="flex items-center gap-3">
            {showKind && <KindTag kind="contest" />}
            <StatusTag tone={statusTone[competition.status]}>{competition.status_title}</StatusTag>
          </div>
          <MetaTag accent={online}>{online ? 'Онлайн' : 'Оффлайн'}</MetaTag>
        </div>

        <h3 className="flex items-start gap-2 text-h3 font-medium text-balance break-words">
          <span className="min-w-0 flex-1">{competition.title}</span>
          {verification ?? (competition.is_verified && <VerifiedMark className="mt-0.5" />)}
        </h3>

        <div className="mt-auto flex flex-col gap-2 text-sm text-muted">
          <span className="flex items-start gap-2">
            <IconCalendar size={16} className="mt-px shrink-0" />
            {competitionDates(competition)}
          </span>
          {place && (
            <span className="flex items-start gap-2">
              <IconMapPin size={16} className="mt-px shrink-0" />
              {place}
            </span>
          )}
          {prize && (
            <span className="flex items-start gap-2 text-ink">
              <IconTrophy size={16} className="mt-px shrink-0" />
              {prize}
            </span>
          )}
        </div>

        {groups.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {groups.map((group) => (
              <MetaTag key={`${group.id}-${group.name}`}>{group.name}</MetaTag>
            ))}
          </div>
        )}

        {extra}

        {footer}
      </div>
    </Card>
  )
}

// Официальные иконки дисциплин из public/brand. Без \w и \b: в регулярках JS они не понимают кириллицу
function disciplineIcon(name: string) {
  const text = name.toLowerCase()
  if (text.includes('алгоритм') || text.includes('олимпиад')) return 'algorithmic'
  if (text.includes('продукт') || text.includes('хакатон')) return 'product'
  if (text.includes('безопасн') || text.includes('ctf')) return 'security'
  if (text.includes('искусствен') || text.includes('машинн')) return 'ai'
  if (text.includes('робот')) return 'robotics'
  if (text.includes('беспилот') || text.includes('бпла') || text.includes('дрон')) return 'drones'
  if (text.includes('квиз') || text.includes('викторин')) return 'quiz'
  return 'generic'
}
