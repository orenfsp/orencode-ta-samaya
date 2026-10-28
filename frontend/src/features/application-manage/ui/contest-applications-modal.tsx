import { useState } from 'react'
import {
  activeMembers,
  applicationTone,
  personName,
  type Application,
  type ApplicationRole,
} from '@/entities/application'
import { competitionDates, teamSize } from '@/entities/competition'
import { useMe } from '@/entities/session'
import { Button, FormAlert, IconChevronLeft, IconPlus, Modal, StatusTag } from '@/shared/ui'
import { canApply, isInvited, type ContestEntry } from '../model/contest-entries'
import type { ApplicationActions } from '../model/use-application-actions'
import { AcademicGroupForm } from './academic-group-form'
import { ApplicationBody } from './application-body'
import { ApplicationForm } from './application-form'

type View = 'list' | 'new' | number

/**
 * Всё про заявки на одно соревнование — в одном окне: список своих заявок (у тренера их может быть много),
 * заявка целиком и новая заявка. Отдельного раздела с заявками нет.
 */
export function ContestApplicationsModal({
  entry,
  role,
  actions,
  open,
  onClose,
}: {
  entry: ContestEntry
  role: ApplicationRole
  actions: ApplicationActions
  open: boolean
  onClose: () => void
}) {
  const { data: me } = useMe()
  const coach = role === 'coach'
  const { contest, applications } = entry
  const applicable = canApply(entry, role)
  const [view, setView] = useState<View>(() =>
    applications.length === 1 ? applications[0].id : applications.length ? 'list' : 'new',
  )
  // Тренер собирает команды подряд: после каждой форма очищается, окно остаётся
  const [teams, setTeams] = useState<string[]>([])
  const needsGroup = !coach && !me?.academic_group

  const current = typeof view === 'number' ? applications.find((item) => item.id === view) : undefined
  // Заявку отозвали или из неё вышли — её больше нет в списке
  const shown: View = typeof view === 'number' && !current ? 'list' : view
  const back = applications.length > 1 || applicable ? () => setView('list') : undefined
  // Кнопки формы и заявки уходят порталом в подвал окна: видны без прокрутки
  const [slot, setSlot] = useState<HTMLDivElement | null>(null)
  const list = !current && shown === 'list'

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={contest.title}
      description={[contest.participation_type_title, teamSize(contest), competitionDates(contest)]
        .filter(Boolean)
        .join(' · ')}
      footer={
        list ? (
          <>
            <Button variant="ghost" onClick={onClose}>
              Закрыть
            </Button>
            {applicable && (
              <Button
                leftIcon={<IconPlus size={18} />}
                onClick={() => {
                  setTeams([])
                  setView('new')
                }}
              >
                {coach
                  ? contest.participation_type === 'team'
                    ? 'Записать ещё команду'
                    : 'Записать ещё'
                  : 'Подать заявку'}
              </Button>
            )}
          </>
        ) : (
          <div ref={setSlot} className="contents" />
        )
      }
    >
      {me && (
        <div className="flex flex-col gap-5 pb-1">
          {needsGroup && (
            <div className="flex flex-col gap-4 rounded-lg border border-line-soft p-4">
              <FormAlert tone="info">Укажите академическую группу. Без неё заявку не примут</FormAlert>
              <AcademicGroupForm compact />
            </div>
          )}

          {current ? (
            <>
              {back && (
                <BackButton onClick={back}>{applications.length > 1 ? 'Все заявки' : 'Назад'}</BackButton>
              )}
              <h3 className="text-body text-ink">{applicationTitle(current, me.id)}</h3>
              <ApplicationBody
                key={current.id}
                item={current}
                userId={me.id}
                actions={actions}
                onClose={() => setView('list')}
                footer={slot}
              />
            </>
          ) : shown === 'new' ? (
            !entry.open ? (
              <p className="text-body text-muted">Регистрация на соревнование закрыта</p>
            ) : entry.problems.length > 0 ? (
              <FormAlert>Не подходите: {entry.problems.join('; ')}</FormAlert>
            ) : !applicable ? (
              <p className="text-body text-muted">Вы уже записаны на это соревнование</p>
            ) : (
              <>
                {teams.length > 0 && (
                  <FormAlert tone="success">
                    Созданы: {teams.join(', ')}. Соберите следующую команду или закройте окно
                  </FormAlert>
                )}
                <ApplicationForm
                  key={teams.length}
                  contest={contest}
                  role={role}
                  actions={actions}
                  onBack={applications.length ? () => setView('list') : undefined}
                  onDone={(teamName) =>
                    coach && teamName ? setTeams((names) => [...names, teamName]) : setView('list')
                  }
                  footer={slot}
                />
              </>
            )
          ) : (
            <>
              <ul className="flex flex-col gap-2" aria-label="Заявки">
                {applications.map((item) => (
                  <ApplicationRow
                    key={item.id}
                    item={item}
                    userId={me.id}
                    actions={actions}
                    onOpen={() => setView(item.id)}
                  />
                ))}
              </ul>
              {!entry.open && <p className="text-sm text-muted">Регистрация закрыта</p>}
            </>
          )}
        </div>
      )}
    </Modal>
  )
}

function BackButton({ onClick, children }: { onClick: () => void; children: string }) {
  return (
    <Button
      variant="text"
      size="sm"
      leftIcon={<IconChevronLeft size={16} />}
      className="self-start"
      onClick={onClick}
    >
      {children}
    </Button>
  )
}

const applicationTitle = (item: Application, userId: string) => {
  if (item.team_name) return item.team_name
  const member = item.members[0]
  if (!member || member.user.id === userId) return 'Личная заявка'
  return personName(member.user)
}

function ApplicationRow({
  item,
  userId,
  actions,
  onOpen,
}: {
  item: Application
  userId: string
  actions: ApplicationActions
  onOpen: () => void
}) {
  const team = item.contest.participation_type === 'team'
  const invited = isInvited(item, userId)
  const members = activeMembers(item)
  const solo = !team && item.members[0]
  const meta = [
    team && `${members.length} из ${teamSize(item.contest)}`,
    solo && solo.user.id !== userId && solo.confirmation_title,
    invited &&
      `${item.creator.last_name} ${item.creator.first_name} зовёт вас в ${team ? 'команду' : 'заявку'}`,
  ].filter(Boolean)

  return (
    <li className="flex flex-col gap-3 rounded-md border border-line-soft px-4 py-3 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate text-body text-ink">{applicationTitle(item, userId)}</span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
          <StatusTag tone={applicationTone[item.status]}>{item.status_title}</StatusTag>
          {meta.map((line) => (
            <span
              key={String(line)}
              className={invited && line === meta.at(-1) ? 'text-live-text' : undefined}
            >
              {line}
            </span>
          ))}
        </span>
        {item.status === 'rejected' && item.reject_reason && (
          <span className="text-sm text-live-text">Отказ: {item.reject_reason}</span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {invited && (
          <Button
            size="sm"
            loading={actions.act.isPending && actions.act.variables?.item.id === item.id}
            onClick={() => actions.act.mutate({ item, action: 'confirm' })}
          >
            Подтвердить
          </Button>
        )}
        <Button size="sm" variant={invited ? 'ghost' : 'secondary'} onClick={onOpen}>
          Открыть
        </Button>
      </div>
    </li>
  )
}
