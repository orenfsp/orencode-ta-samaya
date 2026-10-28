import { personAvatar } from '@/entities/person'
import { useId, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { personName, type ApplicationRole, type AthleteFound } from '@/entities/application'
import type { CompetitionSummary } from '@/entities/competition'
import { fullName, useMe } from '@/entities/session'
import { ApiError } from '@/shared/api'
import { formatDate, plural } from '@/shared/lib'
import {
  Button,
  Field,
  FormAlert,
  IconButton,
  IconClose,
  Input,
  PersonLine,
  RosterSlots,
  Select,
} from '@/shared/ui'
import { memberProblems, type ApplicationActions } from '../model/use-application-actions'
import { AthletePicker } from './athlete-picker'

const PICKER_ID = 'enroll-athlete-search'

/**
 * Новая заявка на соревнование: личная от себя, команда или (у тренера) сразу несколько подопечных.
 * onBack — вернуться к списку заявок, если он есть. footer — подвал окна: кнопки встают туда и видны
 * без прокрутки, сколько бы человек ни выбрали.
 */
export function ApplicationForm({
  contest,
  role,
  actions,
  onBack,
  onDone,
  footer,
}: {
  contest: CompetitionSummary
  role: ApplicationRole
  actions: ApplicationActions
  onBack?: () => void
  /** teamName — у созданной команды; тренер после неё может собрать следующую */
  onDone: (teamName?: string) => void
  footer?: HTMLElement | null
}) {
  const formId = useId()
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

  const buttons = (
    <>
      {onBack && (
        <Button variant="ghost" onClick={onBack} disabled={mutation.isPending}>
          Назад к заявкам
        </Button>
      )}
      <Button type="submit" form={formId} className="sm:ml-auto" loading={mutation.isPending}>
        {team
          ? coach
            ? 'Записать команду'
            : 'Создать команду'
          : batch
            ? picked.length > 1
              ? `Записать ${picked.length} ${plural(picked.length, ['спортсмена', 'спортсменов', 'спортсменов'])}`
              : 'Записать'
            : 'Подать заявку'}
      </Button>
    </>
  )

  return (
    <form id={formId} onSubmit={submit} noValidate className="flex flex-col gap-5">
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
            На каждого выбранного создаётся своя заявка. Спортсмен получит приглашение и после подтверждения
            заявка уйдёт организатору
          </p>
          {picked.length > 0 && (
            <ul className="flex flex-col gap-2" aria-label="Кого записать">
              {picked.map((athlete) => (
                <li key={athlete.id} className="rounded-md border border-line-soft px-3 py-2.5">
                  <PersonLine
                    name={personName(athlete)}
                    avatar={personAvatar(athlete.id)}
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
      {local && (batch || teamName.trim()) && <p className="text-sm text-live-text">{local}</p>}

      {footer ? (
        createPortal(buttons, footer)
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft pt-4">
          {buttons}
        </div>
      )}
    </form>
  )
}
