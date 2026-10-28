import { useState, type FormEvent } from 'react'
import { ApiError } from '@/shared/api'
import { isEmailLike } from '@/shared/lib'
import {
  Button,
  ConfirmModal,
  EmptyState,
  ErrorState,
  Field,
  FormAlert,
  IconPlus,
  Input,
  Modal,
  Select,
  Skeleton,
  StatusTag,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@/shared/ui'
import { useBotAdminActions, useBotAdmins, type BotAdmin, type BotAdminLevel } from '../model/api'

/** Администраторы Telegram-бота: кто что может в «Панели федерации» бота. Управляет только владелец */
export function BotAdminsSection() {
  const admins = useBotAdmins()
  const actions = useBotAdminActions()
  const [grantKey, setGrantKey] = useState(0)
  const [grantOpen, setGrantOpen] = useState(false)
  const [removing, setRemoving] = useState<BotAdmin | null>(null)

  if (admins.isPending) return <Skeleton className="h-48 rounded-lg" />
  if (admins.isError) return <ErrorState error={admins.error} onRetry={() => void admins.refetch()} />
  const data = admins.data
  const labels = Object.fromEntries(data.levels.map((level) => [level.code, level.label])) as Record<
    BotAdminLevel,
    string
  >

  return (
    <div className="flex flex-col gap-5">
      <dl className="grid gap-3 sm:grid-cols-3">
        {data.levels.map((level) => (
          <div key={level.code} className="flex flex-col gap-2 card p-4">
            <dt className="flex items-center justify-between gap-2 text-body text-ink">
              {level.label}
              {data.my_level === level.code && <span className="font-mono text-xs text-muted">вы</span>}
            </dt>
            <dd>
              <ul className="flex list-disc flex-col gap-1 pl-4 text-sm text-muted">
                {level.rights.map((right) => (
                  <li key={right}>{right}</li>
                ))}
              </ul>
            </dd>
          </div>
        ))}
      </dl>

      {!data.can_manage && (
        <FormAlert tone="info">Назначать и снимать администраторов бота может только владелец.</FormAlert>
      )}

      {data.items.length ? (
        <Table>
          <THead>
            <TR>
              <TH>Сотрудник</TH>
              <TH>Уровень</TH>
              <TH>Telegram</TH>
              {data.can_manage && <TH className="w-24" aria-label="Действия" />}
            </TR>
          </THead>
          <TBody>
            {data.items.map((item) => (
              <TR key={item.user_id}>
                <TD>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate">{item.full_name}</span>
                    <span className="truncate text-sm text-muted">{item.email}</span>
                  </span>
                </TD>
                <TD>
                  {data.can_manage ? (
                    <Select
                      aria-label={`Уровень: ${item.full_name}`}
                      value={item.level}
                      onChange={(event) =>
                        actions.change.mutate({
                          id: item.user_id,
                          level: event.target.value as BotAdminLevel,
                        })
                      }
                      options={data.levels.map((level) => ({ value: level.code, label: level.label }))}
                    />
                  ) : (
                    labels[item.level]
                  )}
                </TD>
                <TD>
                  <StatusTag tone={item.linked ? 'active' : 'draft'}>
                    {item.linked ? 'привязан' : 'не привязан'}
                  </StatusTag>
                </TD>
                {data.can_manage && (
                  <TD>
                    <Button variant="text" size="sm" onClick={() => setRemoving(item)}>
                      Снять
                    </Button>
                  </TD>
                )}
              </TR>
            ))}
          </TBody>
        </Table>
      ) : (
        <EmptyState title="Администраторов нет" description="Назначьте сотрудника федерации" />
      )}

      {data.can_manage && (
        <Button
          variant="secondary"
          className="self-start"
          leftIcon={<IconPlus size={18} />}
          onClick={() => {
            setGrantKey((key) => key + 1)
            setGrantOpen(true)
          }}
        >
          Назначить
        </Button>
      )}

      <GrantModal key={grantKey} open={grantOpen} levels={data.levels} onClose={() => setGrantOpen(false)} />
      <ConfirmModal
        open={removing !== null}
        onClose={() => setRemoving(null)}
        onConfirm={() =>
          removing ? actions.revoke.mutateAsync(removing.user_id).then(() => setRemoving(null)) : undefined
        }
        title="Снять администратора?"
        description={
          removing ? `${removing.full_name} потеряет доступ к «Панели федерации» в боте.` : undefined
        }
        confirmLabel="Снять"
        tone="danger"
      />
    </div>
  )
}

function GrantModal({
  open,
  levels,
  onClose,
}: {
  open: boolean
  levels: { code: BotAdminLevel; label: string }[]
  onClose: () => void
}) {
  const { grant } = useBotAdminActions()
  const [email, setEmail] = useState('')
  const [level, setLevel] = useState<BotAdminLevel>('moderator')
  const [touched, setTouched] = useState(false)
  const serverError = grant.error instanceof ApiError ? grant.error : null

  const submit = (event: FormEvent) => {
    event.preventDefault()
    setTouched(true)
    if (!isEmailLike(email)) return
    grant.mutate({ email: email.trim(), level }, { onSuccess: onClose })
  }

  return (
    <Modal
      size="md"
      open={open}
      onClose={onClose}
      onSubmit={submit}
      title="Администратор бота"
      description="Только сотрудник федерации с подтверждённой ролью"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" loading={grant.isPending}>
            Назначить
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {serverError && !Object.keys(serverError.fields ?? {}).length && (
          <FormAlert>{serverError.message}</FormAlert>
        )}
        <Field
          label="Почта сотрудника"
          error={
            (touched && !isEmailLike(email) ? 'Проверьте адрес почты' : undefined) ??
            serverError?.field('email')
          }
        >
          <Input
            type="email"
            autoFocus
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="minister@example.test"
          />
        </Field>
        <Field label="Уровень">
          <Select
            value={level}
            onChange={(event) => setLevel(event.target.value as BotAdminLevel)}
            options={levels.map((item) => ({ value: item.code, label: item.label }))}
          />
        </Field>
      </div>
    </Modal>
  )
}
