import { useState, type FormEvent } from 'react'
import { fullName } from '@/entities/session'
import { ApiError } from '@/shared/api'
import { formatDate, formatDateTime } from '@/shared/lib'
import {
  Button,
  Field,
  FormAlert,
  IconButton,
  IconDots,
  IconRefresh,
  Menu,
  Modal,
  PersonLine,
  StatusTag,
  Textarea,
} from '@/shared/ui'
import { resetConsequence, roleTitles, statusTitles, statusTones } from '../model/labels'
import type { RoleModeration } from '../model/queries'
import type { RoleRequest } from '../model/types'

type Dialog = 'reject' | 'reset' | null

/**
 * Одна роль человека в списке модерации: кто, какая роль, статус и решение.
 * Заявка на проверке решается кнопками прямо в строке, решённую можно вернуть на проверку из меню.
 */
export function RoleRequestRow({
  item,
  currentUserId,
  showRole,
  actions,
}: {
  item: RoleRequest
  currentUserId: string
  /** На вкладке «Все» роль подписывается в строке, на вкладке роли — нет */
  showRole: boolean
  actions: RoleModeration
}) {
  const [dialog, setDialog] = useState<Dialog>(null)
  const close = () => setDialog(null)
  const name = fullName(item.user)
  const own = item.user.id === currentUserId
  const approving = actions.approve.isPending && actions.approve.variables?.id === item.id

  const meta = [showRole && roleTitles[item.role], item.user.email].filter(Boolean).join(' · ')
  const decision =
    item.status === 'pending'
      ? `Заявка от ${formatDate(item.created_at)}`
      : item.decided_at
        ? [
            formatDateTime(item.decided_at),
            item.decided_by && `${item.decided_by.last_name} ${item.decided_by.first_name}`,
          ]
            .filter(Boolean)
            .join(', ')
        : null

  return (
    <li className="flex flex-col gap-3 px-4 py-4 sm:px-5 xl:grid xl:grid-cols-[minmax(0,1fr)_15rem_13rem] xl:items-center xl:gap-6">
      <PersonLine name={name} meta={meta} />

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 pl-[3.25rem] xl:contents">
        <div className="flex min-w-0 flex-col gap-0.5">
          <StatusTag tone={statusTones[item.status]}>{statusTitles[item.status]}</StatusTag>
          {decision && <span className="truncate text-sm text-muted">{decision}</span>}
          {item.status === 'rejected' && item.reject_reason && (
            <span className="text-sm text-live-text">{item.reject_reason}</span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2 xl:justify-end">
          {own ? (
            <span className="text-sm text-muted">Ваша роль</span>
          ) : item.status === 'pending' ? (
            <>
              <Button size="sm" loading={approving} onClick={() => actions.approve.mutate(item)}>
                Подтвердить
              </Button>
              <Button size="sm" variant="ghost" disabled={approving} onClick={() => setDialog('reject')}>
                Отклонить
              </Button>
            </>
          ) : (
            <Menu
              align="end"
              aria-label={`Действия: ${name}`}
              items={[
                {
                  id: 'reset',
                  label: 'Вернуть на проверку',
                  icon: <IconRefresh size={18} />,
                  onSelect: () => setDialog('reset'),
                },
              ]}
              trigger={(props) => (
                <IconButton
                  {...props}
                  aria-label={`Действия: ${name}`}
                  data-no-tooltip
                  icon={<IconDots size={18} />}
                  size="sm"
                />
              )}
            />
          )}
        </div>
      </div>

      {dialog === 'reject' && (
        <ReasonModal
          title="Отклонить заявку?"
          description={`${name}, роль «${roleTitles[item.role]}». Человек увидит причину и сможет запросить роль снова`}
          label="Причина отказа"
          required
          confirmLabel="Отклонить"
          tone="danger"
          pending={actions.reject.isPending}
          error={actions.reject.error}
          onClose={close}
          onSubmit={(reason) => actions.reject.mutate({ item, reason }, { onSuccess: close })}
        />
      )}
      {dialog === 'reset' && (
        <ReasonModal
          title="Вернуть роль на проверку?"
          description={`${name}, роль «${roleTitles[item.role]}». ${resetConsequence[item.role]}`}
          label="Комментарий для журнала"
          confirmLabel="Вернуть на проверку"
          tone={item.status === 'verified' ? 'danger' : 'primary'}
          pending={actions.reset.isPending}
          error={actions.reset.error}
          onClose={close}
          onSubmit={(reason) => actions.reset.mutate({ item, reason }, { onSuccess: close })}
        />
      )}
    </li>
  )
}

function ReasonModal({
  title,
  description,
  label,
  required = false,
  confirmLabel,
  tone,
  pending,
  error,
  onClose,
  onSubmit,
}: {
  title: string
  description: string
  label: string
  required?: boolean
  confirmLabel: string
  tone: 'primary' | 'danger'
  pending: boolean
  error: Error | null
  onClose: () => void
  onSubmit: (reason: string) => void
}) {
  const [reason, setReason] = useState('')
  const [local, setLocal] = useState<string>()
  const server = error instanceof ApiError ? error : null
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const value = reason.trim()
    if ((required || value) && value.length < 3) return setLocal('Не короче 3 символов')
    onSubmit(value)
  }
  return (
    <Modal
      open
      onClose={pending ? () => {} : onClose}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Назад
          </Button>
          <Button type="submit" form="role-reason-form" variant={tone} loading={pending}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <form id="role-reason-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
        {error && !server?.field('reason') && <FormAlert>{error.message}</FormAlert>}
        <Field label={label} required={required} error={local ?? server?.field('reason')}>
          <Textarea
            autoFocus
            autoGrow
            minRows={3}
            maxLength={500}
            value={reason}
            onChange={(event) => {
              setReason(event.target.value)
              setLocal(undefined)
            }}
          />
        </Field>
      </form>
    </Modal>
  )
}
