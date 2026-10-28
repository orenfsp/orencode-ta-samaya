import { useState } from 'react'
import { fullName } from '@/entities/session'
import { Button, ConfirmModal, IconButton, IconDots, IconRefresh, Menu, ReasonModal } from '@/shared/ui'
import { resetConsequence, roleTitles } from '../model/labels'
import type { RoleModeration } from '../model/queries'
import type { RoleRequest } from '../model/types'

type Dialog = 'approve' | 'reject' | 'reset' | null

/**
 * Действия над ролью в строке таблицы модерации: заявку на проверке — подтвердить или отклонить с причиной,
 * решённую — вернуть на проверку из меню. Окна причины живут здесь же.
 */
export function RoleRequestActions({
  item,
  currentUserId,
  actions,
}: {
  item: RoleRequest
  currentUserId: string
  actions: RoleModeration
}) {
  const [dialog, setDialog] = useState<Dialog>(null)
  const close = () => setDialog(null)
  const name = fullName(item.user)
  const own = item.user.id === currentUserId
  const approving = actions.approve.isPending && actions.approve.variables?.id === item.id

  return (
    <div className="inline-flex items-center gap-2">
      {own ? (
        <span className="text-sm text-muted">Ваша роль</span>
      ) : item.status === 'pending' ? (
        <>
          <Button size="sm" loading={approving} onClick={() => setDialog('approve')}>
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

      <ConfirmModal
        open={dialog === 'approve'}
        onClose={close}
        onConfirm={async () => {
          await actions.approve.mutateAsync(item)
        }}
        title="Подтвердить роль?"
        description={`${name} получит доступ к кабинету и действиям роли «${roleTitles[item.role]}».`}
        confirmLabel="Подтвердить роль"
      />

      <ReasonModal
        open={dialog === 'reject'}
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
      <ReasonModal
        open={dialog === 'reset'}
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
    </div>
  )
}
