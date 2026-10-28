import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import type { ApplicationRole } from '@/entities/application'
import {
  competitionDates,
  competitionPlace,
  formatMoment,
  isOnlineFormat,
  PhotoCarousel,
  statusTone,
  teamSize,
  useCompetition,
  type Competition,
} from '@/entities/competition'
import { useMe } from '@/entities/session'
import {
  ContestApplicationsModal,
  isInvited,
  useApplicationActions,
  useContestEntries,
} from '@/features/application-manage'
import { ModerationModal } from '@/features/application-moderate'
import { DocumentRow } from '@/features/competition-manage'
import { ContestDisputesSection } from '@/features/dispute-manage'
import { ContestEvskSection } from '@/features/evsk-rules'
import { JudgeDocumentsSection } from '@/features/judge-documents'
import { ApiError } from '@/shared/api'
import { routes } from '@/shared/config'
import { formatNumber } from '@/shared/lib'
import {
  KindTag,
  MetaTag,
  StatusTag,
  VerifiedMark,
  Breadcrumbs,
  Button,
  Card,
  EmptyState,
  ErrorState,
  FormAlert,
  IconCalendar,
  IconMapPin,
  IconTrophy,
  Skeleton,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@/shared/ui'
import { DocumentsSection } from './documents-section'
import { ResultsSection } from './results-section'

/** Запись и заявки спортсмена или тренера — то же окно, что в кабинете */
function ParticipantAction({
  contestId,
  role,
  userId,
}: {
  contestId: number
  role: ApplicationRole
  userId: string
}) {
  const entries = useContestEntries(role, userId)
  const actions = useApplicationActions()
  const [modal, setModal] = useState({ open: false, key: 0 })
  const entry = entries.data.find((item) => item.contest.id === contestId)
  if (!entry) return null
  const coach = role === 'coach'
  const count = entry.applications.length
  const invited = entry.applications.some((item) => isInvited(item, userId))
  return (
    <>
      <Button
        variant={count && !invited ? 'secondary' : 'primary'}
        onClick={() => setModal((state) => ({ open: true, key: state.key + 1 }))}
      >
        {invited
          ? 'Ответить на приглашение'
          : count
            ? coach
              ? `Заявки подопечных · ${count}`
              : 'Моя заявка'
            : coach
              ? 'Записать спортсменов'
              : 'Записаться'}
      </Button>
      <ContestApplicationsModal
        key={modal.key}
        entry={entry}
        role={role}
        actions={actions}
        open={modal.open}
        onClose={() => setModal((state) => ({ ...state, open: false }))}
      />
    </>
  )
}

/** Кнопки заявок по ролям человека: записаться, записать подопечных, рассмотреть заявки */
function ApplicationActions({ item }: { item: Competition }) {
  const { data: me } = useMe()
  const [moderating, setModerating] = useState({ open: false, key: 0 })
  if (!me) return null
  const roles = me.available_roles
  const scope = roles.includes('federation')
    ? 'admin'
    : roles.includes('organizer') && item.organizer.id === me.id
      ? 'organizer'
      : null
  const participant = (['athlete', 'coach'] as const).filter((role) => roles.includes(role))
  if (!scope && !participant.length) return null
  return (
    <div className="flex flex-col gap-2 border-t border-line-soft pt-5 [&>*]:w-full">
      {participant.map((role) => (
        <ParticipantAction key={role} contestId={item.id} role={role} userId={me.id} />
      ))}
      {scope && item.status !== 'draft' && (
        <>
          <Button
            variant="secondary"
            onClick={() => setModerating((state) => ({ open: true, key: state.key + 1 }))}
          >
            Заявки участников
          </Button>
          <ModerationModal
            key={moderating.key}
            scope={scope}
            contest={item}
            open={moderating.open}
            onClose={() => setModerating((state) => ({ ...state, open: false }))}
          />
        </>
      )}
    </div>
  )
}

/** Кто управляет соревнованием: федерация — любым, организатор — своим */
function useManageScope(item: Competition | undefined) {
  const { data: me } = useMe()
  if (!me || !item) return null
  if (me.available_roles.includes('federation')) return 'admin' as const
  if (me.available_roles.includes('organizer') && item.organizer.id === me.id) return 'organizer' as const
  return null
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="font-mono text-xs text-muted">{label}</dt>
      <dd className="text-body text-ink">{children}</dd>
    </div>
  )
}

/** Публичная карточка соревнования: всё о нём, галерея, положение и баллы у верифицированного */
export function CompetitionPage() {
  const { id = '' } = useParams()
  const competition = useCompetition(Number(id))
  const scope = useManageScope(competition.data)

  if (competition.isPending && Number(id) > 0)
    return (
      <div className="container-page flex flex-col gap-6 py-12">
        <Skeleton className="h-10 w-2/3 rounded-md" />
        <Skeleton className="aspect-video max-h-96 rounded-xl" />
      </div>
    )
  if (competition.isError || !competition.data)
    return (
      <div className="container-page py-12">
        {!competition.isError ||
        (competition.error instanceof ApiError && [404, 422].includes(competition.error.status)) ? (
          <EmptyState
            title="Соревнование не найдено"
            description="Возможно, оно ещё не опубликовано или уже в архиве"
            action={<Button to={routes.competitions}>Все соревнования</Button>}
          />
        ) : (
          <ErrorState error={competition.error} onRetry={() => competition.refetch()} />
        )}
      </div>
    )

  const item = competition.data
  const online = isOnlineFormat(item.contest_format.name)
  const place = competitionPlace(item)
  const size = teamSize(item)
  const groups = [...item.age_groups, ...item.academic_groups]

  return (
    <article className="container-page flex max-w-5xl flex-col gap-8 py-8 sm:py-12">
      <Breadcrumbs
        items={[
          { label: 'Главная', to: routes.home },
          { label: 'Соревнования', to: routes.competitions },
          { label: item.title },
        ]}
      />
      <header className="flex flex-col items-start gap-5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <KindTag kind="contest" />
          <StatusTag tone={statusTone[item.status]}>{item.status_title}</StatusTag>
          <MetaTag accent={online}>{online ? 'Онлайн' : 'Оффлайн'}</MetaTag>
        </div>
        <h1 className="flex items-start gap-3 text-h1 font-medium text-balance break-words">
          <span className="min-w-0">{item.title}</span>
          {item.is_verified && <VerifiedMark className="mt-2 [&_svg]:size-7" />}
        </h1>
        <p className="font-mono text-sm text-primary-text">{item.discipline.name}</p>
      </header>

      {item.status === 'cancelled' && (
        <FormAlert tone="info">
          Соревнование отменено{item.cancel_reason ? `: ${item.cancel_reason}` : ''}
        </FormAlert>
      )}

      {item.photos.length > 0 && (
        <PhotoCarousel photos={item.photos} title={item.title} controls className="rounded-xl" />
      )}

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex flex-col gap-8">
          {item.description ? (
            <p className="text-body leading-relaxed break-words whitespace-pre-wrap text-muted">
              {item.description}
            </p>
          ) : (
            <p className="text-body text-muted">Организатор пока не добавил описание.</p>
          )}

          {item.regulations && (
            <section className="flex flex-col gap-3">
              <h2 className="text-h3 font-medium">Положение</h2>
              <DocumentRow file={item.regulations} />
            </section>
          )}

          {item.is_verified && item.rating_points && item.rating_points.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="text-h3 font-medium">Баллы в рейтинг</h2>
              <p className="text-sm text-muted">
                Начисляются за занятое место по дисциплине и группе. Остальные места — 0 баллов
              </p>
              <Table>
                <THead>
                  <TR>
                    <TH>Место</TH>
                    <TH className="text-right">Баллы</TH>
                  </TR>
                </THead>
                <TBody>
                  {item.rating_points.map((row) => (
                    <TR key={row.place}>
                      <TD className="font-mono">{row.place}</TD>
                      <TD className="text-right font-mono">{formatNumber(row.points)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </section>
          )}
        </div>

        <Card className="flex flex-col gap-5 lg:sticky lg:top-24">
          <p className="flex items-start gap-3">
            <IconCalendar className="shrink-0" />
            {competitionDates(item)}
          </p>
          {place && (
            <p className="flex items-start gap-3">
              <IconMapPin className="shrink-0" />
              {place}
            </p>
          )}
          {(item.prize_fund_amount != null || item.prize_fund_text) && (
            <p className="flex items-start gap-3">
              <IconTrophy className="shrink-0" />
              <span className="flex flex-col">
                {item.prize_fund_amount != null && <span>{formatNumber(item.prize_fund_amount)} ₽</span>}
                {item.prize_fund_text && <span className="text-sm text-muted">{item.prize_fund_text}</span>}
              </span>
            </p>
          )}
          <dl className="flex flex-col gap-4 border-t border-line-soft pt-5">
            <Fact label="Регистрация">
              {formatMoment(item.registration_opens_at)} — {formatMoment(item.registration_closes_at)}
            </Fact>
            <Fact label="Участие">
              {item.participation_type_title}
              {size && ` · ${size}`}
            </Fact>
            <Fact label="Тип и уровень">
              {item.contest_type.name} · {item.contest_level.name}
            </Fact>
            <Fact label="Формат">{item.contest_format.name}</Fact>
            {item.calendar_plan !== 'none' && (
              <Fact label="Календарный план">
                {item.calendar_plan_title}
                {item.calendar_plan_number && `, ${item.calendar_plan_number}`}
              </Fact>
            )}
            {groups.length > 0 && (
              <Fact label="Группы">
                <span className="mt-1 flex flex-wrap gap-1.5">
                  {groups.map((group) => (
                    <MetaTag key={`${group.id}-${group.name}`}>{group.name}</MetaTag>
                  ))}
                </span>
              </Fact>
            )}
            <Fact label="Организатор">
              <Link
                to={routes.person(item.organizer.id)}
                className="rounded-sm link-underline focus-visible:field-focus"
              >
                {item.organizer.full_name}
              </Link>
            </Fact>
          </dl>
          <ApplicationActions item={item} />
        </Card>
      </div>

      <ResultsSection item={item} scope={scope} />

      <JudgeDocumentsSection contest={item} />

      <ContestEvskSection contestId={item.id} enabled={Boolean(scope)} />

      <ContestDisputesSection
        contestId={item.id}
        held={item.status === 'in_progress' || item.status === 'completed'}
      />

      <DocumentsSection item={item} scope={scope} />

      <div>
        <Button to={routes.competitions} variant="secondary">
          Все соревнования
        </Button>
      </div>
    </article>
  )
}
