import { useState, type FormEvent } from 'react'
import {
  personName,
  useAvailableContests,
  type ApplicationRole,
  type AthleteFound,
  type AvailableContest,
} from '@/entities/application'
import { competitionDates, teamSize, type CompetitionSummary } from '@/entities/competition'
import { fullName, useMe } from '@/entities/session'
import { ApiError } from '@/shared/api'
import { routes } from '@/shared/config'
import { formatDate, plural } from '@/shared/lib'
import {
  Button,
  Drawer,
  EmptyState,
  ErrorState,
  Field,
  FormAlert,
  IconArrowRight,
  IconButton,
  IconClose,
  Input,
  MetaTag,
  PersonLine,
  RosterSlots,
  Select,
  Skeleton,
  TextLink,
} from '@/shared/ui'
import { memberProblems, type ApplicationActions } from '../model/use-application-actions'
import { AcademicGroupForm } from './academic-group-form'
import { AthletePicker } from './athlete-picker'

const PICKER_ID = 'enroll-athlete-search'

/**
 * «Записаться» у спортсмена и «Записать спортсменов» у тренера. Шаг 1 — соревнования с открытой
 * регистрацией (у спортсмена сразу видно, почему не пройдёт), шаг 2 — заявка: личная или команда.
 */
export function EnrollDrawer({
  open,
  role,
  actions,
  onClose,
}: {
  open: boolean
  role: ApplicationRole
  actions: ApplicationActions
  onClose: () => void
}) {
  const [contest, setContest] = useState<CompetitionSummary | null>(null)
  // Тренер собирает команды подряд: после каждой форма очищается, соревнование остаётся
  const [teams, setTeams] = useState<string[]>([])
  const available = useAvailableContests(role, open)
  const { data: me } = useMe()
  const coach = role === 'coach'
  const needsGroup = !coach && !me?.academic_group
  const pickContest = (next: CompetitionSummary | null) => {
    setContest(next)
    setTeams([])
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={contest ? contest.title : coach ? 'Записать спортсменов' : 'Записаться на соревнование'}
      description={
        contest
          ? [contest.participation_type_title, teamSize(contest), competitionDates(contest)]
              .filter(Boolean)
              .join(' · ')
          : 'Соревнования, где сейчас открыта регистрация'
      }
    >
      {contest ? (
        <div className="flex flex-col gap-5">
          {teams.length > 0 && (
            <FormAlert tone="success">
              Созданы: {teams.join(', ')}. Соберите следующую команду или закройте панель
            </FormAlert>
          )}
          <ApplicationForm
            key={`${contest.id}-${teams.length}`}
            contest={contest}
            role={role}
            actions={actions}
            onBack={() => pickContest(null)}
            onDone={(teamName) =>
              coach && teamName ? setTeams((current) => [...current, teamName]) : onClose()
            }
          />
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {needsGroup && (
            <div className="flex flex-col gap-4 rounded-lg border border-line-soft p-4">
              <FormAlert tone="info">Укажите академическую группу: без неё заявку не принять</FormAlert>
              <AcademicGroupForm compact onSaved={() => void available.refetch()} />
            </div>
          )}
          {available.isPending ? (
            [1, 2, 3].map((id) => <Skeleton key={id} className="h-28 rounded-lg" />)
          ) : available.isError ? (
            <ErrorState error={available.error} onRetry={() => available.refetch()} />
          ) : !available.data.length ? (
            <EmptyState
              title="Записаться сейчас некуда"
              description="Здесь появятся соревнования, когда откроется регистрация"
            />
          ) : (
            <ul className="flex flex-col gap-3">
              {available.data.map((item) => (
                <ContestOption key={item.contest.id} item={item} onPick={() => pickContest(item.contest)} />
              ))}
            </ul>
          )}
        </div>
      )}
    </Drawer>
  )
}

function ContestOption({ item, onPick }: { item: AvailableContest; onPick: () => void }) {
  const { contest, problems } = item
  const size = teamSize(contest)
  return (
    <li className="flex flex-col gap-3 rounded-lg border border-line-soft p-4">
      <div className="flex flex-col gap-1">
        <span className="text-body text-ink">{contest.title}</span>
        <span className="text-sm text-muted">
          {contest.discipline.name} · {competitionDates(contest)}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <MetaTag>{size ? `Команда ${size}` : 'Личное'}</MetaTag>
        {[...contest.age_groups, ...contest.academic_groups].map((group) => (
          <MetaTag key={`${group.id}-${group.name}`}>{group.name}</MetaTag>
        ))}
      </div>
      {problems.length > 0 && <p className="text-sm text-live-text">Не подходите: {problems.join('; ')}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TextLink to={routes.competition(contest.id)} className="text-sm">
          Карточка соревнования
        </TextLink>
        <Button
          size="sm"
          disabled={problems.length > 0}
          rightIcon={<IconArrowRight size={16} />}
          onClick={onPick}
        >
          Выбрать
        </Button>
      </div>
    </li>
  )
}

function ApplicationForm({
  contest,
  role,
  actions,
  onBack,
  onDone,
}: {
  contest: CompetitionSummary
  role: ApplicationRole
  actions: ApplicationActions
  onBack: () => void
  /** teamName — у созданной команды; тренер после неё может собрать следующую */
  onDone: (teamName?: string) => void
}) {
  const { data: me } = useMe()
  const coach = role === 'coach'
  const team = contest.participation_type === 'team'
  // Тренер в личном соревновании записывает сразу несколько человек: по заявке на каждого
  const batch = coach && !team
  const min = contest.team_size_min ?? 1
  const max = contest.team_size_max ?? 1
  const [teamName, setTeamName] = useState('')
  const [picked, setPicked] = useState<AthleteFound[]>([])
  const [captainId, setCaptainId] = useState('')
  const [local, setLocal] = useState<string>()
  const mutation = batch ? actions.createForAthletes : actions.create
  const server = mutation.error instanceof ApiError ? mutation.error : null
  const problems = mutation.error ? memberProblems(mutation.error) : []
  const self = !coach && me ? [{ id: me.id, name: fullName(me), captain: team }] : []
  const roster = [...self, ...picked.map((athlete) => ({ id: athlete.id, name: personName(athlete) }))]
  const room = team ? max - roster.length : batch ? Infinity : 0
  const unpick = (id: string) => setPicked((current) => current.filter((item) => item.id !== id))

  const pick = (athlete: AthleteFound) => {
    setLocal(undefined)
    setPicked((current) => [...current, athlete])
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (team && !teamName.trim()) return setLocal('Укажите название команды')
    if (coach && !picked.length) return setLocal('Выберите спортсменов')
    if (batch)
      return actions.createForAthletes.mutate(
        { contestId: contest.id, memberIds: picked.map((athlete) => athlete.id) },
        { onSuccess: () => onDone() },
      )
    actions.create.mutate(
      {
        contestId: contest.id,
        body: {
          as: role,
          team_name: team ? teamName.trim() : null,
          member_ids: picked.map((athlete) => athlete.id),
          captain_id: coach && team && captainId ? captainId : null,
        },
      },
      { onSuccess: (item) => onDone(item.team_name ?? undefined) },
    )
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      {problems.length > 0 && (
        <FormAlert>
          <ul className="flex flex-col gap-1">
            {problems.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </FormAlert>
      )}

      {team && (
        <Field
          label="Название команды"
          required
          error={local && !teamName.trim() ? local : server?.field('team_name')}
        >
          <Input
            autoFocus
            maxLength={100}
            value={teamName}
            onChange={(event) => setTeamName(event.target.value)}
          />
        </Field>
      )}

      {team ? (
        <RosterSlots
          members={roster.map((member) => ({ ...member, meta: 'Получит приглашение' }))}
          min={min}
          max={max}
          onAdd={() => document.querySelector<HTMLInputElement>(`#${PICKER_ID} input`)?.focus()}
          onRemove={unpick}
        />
      ) : !coach ? (
        <p className="text-body text-muted">Личная заявка от вашего имени. Её сразу увидит организатор.</p>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted">
            На каждого выбранного — своя заявка. Спортсмен получит приглашение, после подтверждения заявка
            уйдёт организатору
          </p>
          {picked.length > 0 && (
            <ul className="flex flex-col gap-2" aria-label="Кого записать">
              {picked.map((athlete) => (
                <li key={athlete.id} className="rounded-md border border-line-soft px-3 py-2.5">
                  <PersonLine
                    name={personName(athlete)}
                    meta={[formatDate(athlete.birth_date), athlete.academic_group?.name]
                      .filter(Boolean)
                      .join(' · ')}
                    trailing={
                      <IconButton
                        aria-label={`Убрать: ${personName(athlete)}`}
                        size="sm"
                        icon={<IconClose size={18} />}
                        onClick={() => unpick(athlete.id)}
                      />
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {coach && team && picked.length > 0 && (
        <Field label="Капитан" hint="Капитан тоже может звать людей и подавать заявку">
          <Select
            value={captainId}
            options={[
              { value: '', label: 'Без капитана' },
              ...picked.map((athlete) => ({ value: athlete.id, label: personName(athlete) })),
            ]}
            onChange={(event) => setCaptainId(event.target.value)}
          />
        </Field>
      )}

      {(team || coach) && room > 0 && (
        <AthletePicker
          contestId={contest.id}
          exclude={roster.map((member) => member.id)}
          onPick={pick}
          inputId={PICKER_ID}
          addedLabel={batch ? 'Выбран' : 'В составе'}
          label={team ? 'Пригласить в команду' : 'Кого записать'}
        />
      )}
      {batch && local && <p className="text-sm text-live-text">{local}</p>}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft pt-4">
        <Button variant="ghost" onClick={onBack} disabled={mutation.isPending}>
          Другое соревнование
        </Button>
        <Button type="submit" loading={mutation.isPending}>
          {team
            ? 'Создать команду'
            : batch
              ? picked.length > 1
                ? `Записать ${picked.length} ${plural(picked.length, ['спортсмена', 'спортсменов', 'спортсменов'])}`
                : 'Записать'
              : 'Подать заявку'}
        </Button>
      </div>
    </form>
  )
}
