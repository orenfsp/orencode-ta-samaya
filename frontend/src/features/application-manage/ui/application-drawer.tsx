import { useState, type FormEvent } from 'react'
import {
  activeMembers,
  applicationTone,
  canManage,
  isOpenForChanges,
  personName,
  type Application,
  type ApplicationMember,
} from '@/entities/application'
import { competitionDates } from '@/entities/competition'
import { ApiError } from '@/shared/api'
import { routes } from '@/shared/config'
import { formatDate } from '@/shared/lib'
import {
  Button,
  ConfirmModal,
  Drawer,
  Field,
  FormAlert,
  Input,
  PersonLine,
  RosterSlots,
  StatusTag,
  TextLink,
} from '@/shared/ui'
import { memberProblems, type ApplicationActions } from '../model/use-application-actions'
import { AthletePicker } from './athlete-picker'

const memberMeta = (member: ApplicationMember) =>
  [
    member.confirmation_title,
    formatDate(member.user.birth_date),
    (member.academic_group ?? member.user.academic_group)?.name,
  ]
    .filter(Boolean)
    .join(' · ')

/**
 * Заявка целиком: состав, приглашения, подача. Автор и капитан управляют составом,
 * приглашённый отвечает на приглашение, участник может выйти из команды.
 */
export function ApplicationDrawer({
  item,
  userId,
  actions,
  open,
  onClose,
}: {
  item: Application | null
  userId: string
  actions: ApplicationActions
  open: boolean
  onClose: () => void
}) {
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={item ? (item.team_name ?? item.contest.title) : ''}
      description={item ? (item.team_name ? item.contest.title : competitionDates(item.contest)) : undefined}
    >
      {item && (
        <ApplicationBody key={item.id} item={item} userId={userId} actions={actions} onClose={onClose} />
      )}
    </Drawer>
  )
}

function ApplicationBody({
  item,
  userId,
  actions,
  onClose,
}: {
  item: Application
  userId: string
  actions: ApplicationActions
  onClose: () => void
}) {
  const [confirm, setConfirm] = useState<'withdraw' | 'decline' | null>(null)
  const [adding, setAdding] = useState(false)
  const [teamName, setTeamName] = useState(item.team_name ?? '')
  const manager = canManage(item, userId)
  const open = isOpenForChanges(item)
  const team = item.contest.participation_type === 'team'
  const members = activeMembers(item)
  const declined = item.members.filter((member) => !member.is_active)
  const mine = item.members.find((member) => member.user.id === userId)
  const min = item.contest.team_size_min ?? 1
  const max = item.contest.team_size_max ?? 1
  const lastError = actions.act.error ?? actions.addMember.error ?? actions.rename.error
  const problems = lastError ? memberProblems(lastError) : []
  const renameError =
    actions.rename.error instanceof ApiError ? actions.rename.error.field('team_name') : undefined
  const waiting = members.filter((member) => member.confirmation !== 'confirmed').length

  const rename = (event: FormEvent) => {
    event.preventDefault()
    if (teamName.trim() && teamName.trim() !== item.team_name)
      actions.rename.mutate({ id: item.id, name: teamName.trim() })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <StatusTag tone={applicationTone[item.status]}>{item.status_title}</StatusTag>
        {item.status === 'rejected' && item.reject_reason && (
          <p className="text-sm text-live-text">Причина отказа: {item.reject_reason}</p>
        )}
        {item.status === 'forming' && team && (
          <p className="text-sm text-muted">
            {waiting > 0
              ? `Ждём подтверждения: ${waiting}. Подать можно, когда все ответят и состав соберётся`
              : members.length < min
                ? `Нужно ещё участников: ${min - members.length}`
                : 'Состав собран, заявку можно подавать'}
          </p>
        )}
        {['submitted', 'approved'].includes(item.status) && team && manager && open && (
          <p className="text-sm text-muted">Если изменить состав, заявку нужно будет подать заново</p>
        )}
        <TextLink to={routes.competition(item.contest.id)} className="text-sm">
          Карточка соревнования
        </TextLink>
      </div>

      {problems.length > 0 && (
        <FormAlert>
          <ul className="flex flex-col gap-1">
            {problems.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </FormAlert>
      )}

      {team && manager && open && (
        <form onSubmit={rename} noValidate className="flex items-end gap-3">
          <Field label="Название команды" error={renameError} className="flex-1">
            <Input maxLength={100} value={teamName} onChange={(event) => setTeamName(event.target.value)} />
          </Field>
          <Button
            type="submit"
            variant="secondary"
            loading={actions.rename.isPending}
            disabled={!teamName.trim() || teamName.trim() === item.team_name}
          >
            Сохранить
          </Button>
        </form>
      )}

      {team ? (
        <RosterSlots
          members={members.map((member) => ({
            id: member.user.id,
            name: personName(member.user),
            captain: member.is_captain,
            meta: memberMeta(member),
          }))}
          min={min}
          max={max}
          readOnly={!manager || !open}
          onAdd={() => setAdding(true)}
          onRemove={(id) => actions.removeMember.mutate({ id: item.id, userId: id })}
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {item.members.map((member) => (
            <li key={member.user.id} className="rounded-md border border-line-soft px-3 py-2.5">
              <PersonLine name={personName(member.user)} meta={memberMeta(member)} />
            </li>
          ))}
        </ul>
      )}

      {team && manager && open && adding && members.length < max && (
        <AthletePicker
          contestId={item.contest.id}
          exclude={members.map((member) => member.user.id)}
          pendingId={actions.addMember.isPending ? actions.addMember.variables?.userId : null}
          onPick={(athlete) =>
            actions.addMember.mutate(
              { id: item.id, userId: athlete.id },
              { onSuccess: () => setAdding(false) },
            )
          }
          label="Пригласить в команду"
        />
      )}

      {team && declined.length > 0 && (
        <p className="text-sm text-muted">
          Отказались: {declined.map((member) => personName(member.user)).join(', ')}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-line-soft pt-4">
        {mine?.confirmation === 'invited' && mine.is_active && open && (
          <>
            <Button
              loading={actions.act.isPending && actions.act.variables?.action === 'confirm'}
              onClick={() => actions.act.mutate({ item, action: 'confirm' })}
            >
              Подтвердить участие
            </Button>
            <Button variant="ghost" onClick={() => setConfirm('decline')}>
              Отказаться
            </Button>
          </>
        )}
        {manager && item.status === 'forming' && open && team && (
          <Button
            disabled={waiting > 0 || members.length < min}
            loading={actions.act.isPending && actions.act.variables?.action === 'submit'}
            onClick={() => actions.act.mutate({ item, action: 'submit' })}
          >
            Подать на рассмотрение
          </Button>
        )}
        {mine?.confirmation === 'confirmed' &&
          !mine.is_captain &&
          !manager &&
          item.status !== 'withdrawn' && (
            <Button variant="ghost" onClick={() => setConfirm('decline')}>
              Выйти из {team ? 'команды' : 'заявки'}
            </Button>
          )}
        {manager && !['withdrawn', 'rejected'].includes(item.status) && (
          <Button variant="ghost" className="ml-auto" onClick={() => setConfirm('withdraw')}>
            Отозвать заявку
          </Button>
        )}
      </div>

      <ConfirmModal
        open={confirm === 'withdraw'}
        onClose={() => setConfirm(null)}
        tone="danger"
        title="Отозвать заявку?"
        description={
          team
            ? 'Команда снимется с соревнования, участники освободятся для других заявок'
            : 'Вы снимаетесь с соревнования'
        }
        confirmLabel="Отозвать"
        onConfirm={async () => {
          await actions.act.mutateAsync({ item, action: 'withdraw' })
          onClose()
        }}
      />
      <ConfirmModal
        open={confirm === 'decline'}
        onClose={() => setConfirm(null)}
        tone="danger"
        title={mine?.confirmation === 'confirmed' ? 'Выйти из команды?' : 'Отказаться от участия?'}
        description="Автор заявки увидит, что вы отказались"
        confirmLabel={mine?.confirmation === 'confirmed' ? 'Выйти' : 'Отказаться'}
        onConfirm={async () => {
          await actions.act.mutateAsync({ item, action: 'decline' })
          onClose()
        }}
      />
    </div>
  )
}
