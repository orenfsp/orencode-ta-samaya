import { personAvatar } from '@/entities/person'
import { useState } from 'react'
import { activeMembers, applicationTone, personName, type ModeratedApplication } from '@/entities/application'
import { formatDate, formatDateTime } from '@/shared/lib'
import {
  Button,
  Checkbox,
  ConfirmModal,
  IconButton,
  IconDots,
  IconRefresh,
  Menu,
  PersonLine,
  ReasonModal,
  StatusTag,
} from '@/shared/ui'
import type { Moderation } from '../model/use-moderation'

/**
 * Заявка в модерации: команда или человек, состав с датой рождения и группами на дату соревнования.
 * На рассмотрении — «Одобрить» и «Отклонить» в строке, решённую можно вернуть из меню.
 */
export function ModeratedRow({
  item,
  moderation,
  selected,
  onToggle,
}: {
  item: ModeratedApplication
  moderation: Moderation
  selected: boolean
  onToggle: () => void
}) {
  const [rejecting, setRejecting] = useState(false)
  const [confirmation, setConfirmation] = useState<'approve' | 'reset' | null>(null)
  const members = activeMembers(item)
  const title = item.team_name ?? (members[0] ? personName(members[0].user) : `Заявка №${item.id}`)
  const pending = item.status === 'submitted'
  const approving = moderation.approve.isPending && moderation.approve.variables?.includes(item.id)
  const author =
    item.created_as === 'coach'
      ? `Тренер ${item.creator.last_name} ${item.creator.first_name}`
      : item.team_name
        ? `Капитан ${item.creator.last_name} ${item.creator.first_name}`
        : null

  const solo = item.team_name ? null : members[0]
  const memberMeta = (member: (typeof members)[number]) => [
    formatDate(member.user.birth_date),
    member.age_group?.name,
    member.academic_group?.name,
    member.confirmation !== 'confirmed' && member.confirmation_title,
  ]

  return (
    <li className="flex flex-col gap-4 px-4 py-4 sm:px-5">
      <div className="flex min-w-0 flex-1 gap-3">
        {pending ? (
          <Checkbox
            aria-label={`Выбрать: ${title}`}
            checked={selected}
            onChange={onToggle}
            className="mt-0.5"
          />
        ) : (
          <span className="w-5 shrink-0" aria-hidden="true" />
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-body text-ink">{title}</span>
            <span className="text-sm text-muted">
              {[
                ...(solo ? memberMeta(solo) : []),
                author,
                item.submitted_at && `подана ${formatDateTime(item.submitted_at)}`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </div>
          {!solo && (
            <ul className="flex flex-col gap-2">
              {members.map((member) => (
                <li key={member.user.id}>
                  <PersonLine
                    size="sm"
                    avatar={personAvatar(member.user.id)}
                    name={`${personName(member.user)}${member.is_captain ? ', капитан' : ''}`}
                    meta={memberMeta(member).filter(Boolean).join(' · ')}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3 pl-8">
        <div className="flex min-w-0 flex-col gap-1">
          <StatusTag tone={applicationTone[item.status]}>{item.status_title}</StatusTag>
          {item.decided_at && item.decided_by && (
            <span className="text-sm text-muted">
              {formatDateTime(item.decided_at)}, {item.decided_by.last_name}
            </span>
          )}
          {item.status === 'rejected' && item.reject_reason && (
            <span className="text-sm text-live-text">{item.reject_reason}</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {pending ? (
            <>
              <Button size="sm" loading={approving} onClick={() => setConfirmation('approve')}>
                Одобрить
              </Button>
              <Button size="sm" variant="ghost" disabled={approving} onClick={() => setRejecting(true)}>
                Отклонить
              </Button>
            </>
          ) : item.status === 'approved' || item.status === 'rejected' ? (
            <Menu
              align="end"
              aria-label={`Действия: ${title}`}
              items={[
                {
                  id: 'reset',
                  label: 'Вернуть на рассмотрение',
                  icon: <IconRefresh size={18} />,
                  onSelect: () => setConfirmation('reset'),
                },
              ]}
              trigger={(props) => (
                <IconButton
                  {...props}
                  aria-label={`Действия: ${title}`}
                  data-no-tooltip
                  icon={<IconDots size={18} />}
                  size="sm"
                />
              )}
            />
          ) : null}
        </div>
      </div>

      <ConfirmModal
        open={confirmation !== null}
        onClose={() => setConfirmation(null)}
        onConfirm={async () => {
          if (confirmation === 'approve') await moderation.approve.mutateAsync([item.id])
          else if (confirmation === 'reset') await moderation.reset.mutateAsync(item.id)
        }}
        title={confirmation === 'approve' ? 'Одобрить заявку?' : 'Вернуть заявку на рассмотрение?'}
        description={`${title}. ${confirmation === 'approve' ? 'Участники будут допущены к соревнованию и получат уведомление.' : 'Предыдущее решение будет отменено. По заявке нужно будет принять новое решение.'}`}
        confirmLabel={confirmation === 'approve' ? 'Одобрить заявку' : 'Вернуть на рассмотрение'}
      />

      <ReasonModal
        open={rejecting}
        label="Причина отказа"
        confirmLabel="Отклонить"
        title="Отклонить заявку?"
        description={`${title}. Участники увидят причину`}
        pending={moderation.reject.isPending}
        error={moderation.reject.error}
        onClose={() => setRejecting(false)}
        onSubmit={(reason) =>
          moderation.reject.mutate({ ids: [item.id], reason }, { onSuccess: () => setRejecting(false) })
        }
      />
    </li>
  )
}
