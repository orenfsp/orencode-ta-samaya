import { useState, type FormEvent } from 'react'
import {
  actionLabel,
  canCancel,
  canDelete,
  canEdit,
  isPublic,
  statusActions,
  statusTitles,
  useCompetitionHistory,
  useRatingDefaults,
  verificationTitles,
  type CompetitionScope,
  type ManagedCompetition,
  type RatingPoint,
} from '@/entities/competition'
import { ApiError } from '@/shared/api'
import { routes } from '@/shared/config'
import { formatDateTime } from '@/shared/lib'
import {
  Button,
  ConfirmModal,
  ErrorState,
  Field,
  FormAlert,
  IconArrowRight,
  IconButton,
  IconCheck,
  IconClose,
  IconDots,
  IconExternal,
  IconPencil,
  IconRefresh,
  IconTrash,
  Menu,
  Modal,
  Skeleton,
  Textarea,
  type MenuItem,
} from '@/shared/ui'
import type { CompetitionActions } from '../model/use-competition-actions'
import { RatingPointsEditor } from './rating-points-editor'

type Dialog = 'cancel' | 'delete' | 'verify' | 'points' | 'reject' | 'revoke' | 'history' | null

const valueTitles: Record<string, string> = { ...statusTitles, ...verificationTitles }

/** Меню строки соревнования и все его диалоги. Пункты — только доступные в текущем статусе */
export function CompetitionActions({
  item,
  scope,
  actions,
  onEdit,
}: {
  item: ManagedCompetition
  scope: CompetitionScope
  actions: CompetitionActions
  onEdit: () => void
}) {
  const [dialog, setDialog] = useState<Dialog>(null)
  const admin = scope === 'admin'
  const verification = item.verification_status
  const close = () => setDialog(null)

  const items: MenuItem[] = [
    ...(canEdit(item.status)
      ? [{ id: 'edit', label: 'Изменить', icon: <IconPencil size={18} />, onSelect: onEdit }]
      : []),
    ...statusActions[item.status].map((action) => ({
      id: action,
      label: actionLabel(action, item.status),
      icon: <IconArrowRight size={18} />,
      onSelect: () => actions.transition.mutate({ item, action }),
    })),
    ...(!admin &&
    (verification === 'not_requested' || verification === 'rejected') &&
    item.status !== 'archived'
      ? [
          {
            id: 'request',
            label: 'Запросить верификацию',
            description: 'Федерация проверит и настроит баллы за места',
            icon: <IconCheck size={18} />,
            onSelect: () => actions.requestVerification.mutate(item),
          },
        ]
      : []),
    ...(admin && verification !== 'verified'
      ? [
          {
            id: 'verify',
            label: 'Верифицировать',
            icon: <IconCheck size={18} />,
            onSelect: () => setDialog('verify'),
          },
        ]
      : []),
    ...(admin && verification === 'pending'
      ? [
          {
            id: 'reject',
            label: 'Отказать в верификации',
            icon: <IconClose size={18} />,
            onSelect: () => setDialog('reject'),
          },
        ]
      : []),
    ...(admin && verification === 'verified'
      ? [
          // Баллы верифицированного зафиксированы (бэк отвечает 409 points_locked): только снять и верифицировать заново
          {
            id: 'revoke',
            label: 'Снять верификацию',
            icon: <IconRefresh size={18} />,
            onSelect: () => setDialog('revoke'),
          },
        ]
      : []),
    ...(admin
      ? [
          {
            id: 'history',
            label: 'История',
            icon: <IconRefresh size={18} />,
            onSelect: () => setDialog('history'),
          },
        ]
      : []),
    ...(isPublic(item.status)
      ? [
          {
            id: 'open',
            label: 'Открыть на сайте',
            icon: <IconExternal size={18} />,
            onSelect: () => window.open(routes.competition(item.id), '_blank', 'noopener'),
          },
        ]
      : []),
    ...(canCancel(item.status)
      ? [
          {
            id: 'cancel',
            label: 'Отменить',
            icon: <IconClose size={18} />,
            onSelect: () => setDialog('cancel'),
          },
        ]
      : []),
    ...(canDelete(item.status)
      ? [
          {
            id: 'delete',
            label: 'Удалить',
            icon: <IconTrash size={18} />,
            onSelect: () => setDialog('delete'),
          },
        ]
      : []),
  ]

  return (
    <>
      <Menu
        align="end"
        aria-label={`Действия: ${item.title}`}
        items={items}
        trigger={(props) => (
          <IconButton
            {...props}
            aria-label={`Действия: ${item.title}`}
            data-no-tooltip
            icon={<IconDots size={18} />}
            size="sm"
          />
        )}
      />

      {dialog === 'cancel' && (
        <ReasonModal
          title={`Отменить «${item.title}»?`}
          description="Соревнование останется в календаре со статусом «Отменено» и причиной"
          label="Причина отмены"
          confirmLabel="Отменить соревнование"
          pending={actions.cancel.isPending}
          error={actions.cancel.error}
          onClose={close}
          onSubmit={(reason) => actions.cancel.mutate({ item, reason }, { onSuccess: close })}
        />
      )}
      {dialog === 'reject' && (
        <ReasonModal
          title="Отказать в верификации?"
          description={`Организатор увидит причину и сможет запросить верификацию снова`}
          label="Причина отказа"
          confirmLabel="Отказать"
          pending={actions.reject.isPending}
          error={actions.reject.error}
          onClose={close}
          onSubmit={(reason) => actions.reject.mutate({ item, reason }, { onSuccess: close })}
        />
      )}
      {(dialog === 'verify' || dialog === 'points') && (
        <PointsModal
          item={item}
          mode={dialog}
          pending={dialog === 'verify' ? actions.verify.isPending : actions.setPoints.isPending}
          error={dialog === 'verify' ? actions.verify.error : actions.setPoints.error}
          onClose={close}
          onSubmit={(points) =>
            (dialog === 'verify' ? actions.verify : actions.setPoints).mutate(
              { item, points },
              { onSuccess: close },
            )
          }
        />
      )}
      {dialog === 'history' && <HistoryModal item={item} onClose={close} />}

      <ConfirmModal
        open={dialog === 'delete'}
        onClose={close}
        onConfirm={() => actions.remove.mutateAsync(item).then(close)}
        title={`Удалить «${item.title}»?`}
        description="Соревнование удалится насовсем вместе с историей. Идущие и прошедшие можно только отправить в архив."
        confirmLabel="Удалить"
        tone="danger"
      />
      <ConfirmModal
        open={dialog === 'revoke'}
        onClose={close}
        onConfirm={() => actions.revoke.mutateAsync(item).then(close)}
        title="Снять верификацию?"
        description="Значок пропадёт, баллы за места сбросятся, соревнование перестанет влиять на рейтинг."
        confirmLabel="Снять"
      />
    </>
  )
}

function ReasonModal({
  title,
  description,
  label,
  confirmLabel,
  pending,
  error,
  onClose,
  onSubmit,
}: {
  title: string
  description: string
  label: string
  confirmLabel: string
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
    if (reason.trim().length < 3) return setLocal('Не короче 3 символов')
    onSubmit(reason.trim())
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
          <Button type="submit" form="reason-form" variant="danger" loading={pending}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <form id="reason-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
        {error && !server?.field('reason') && <FormAlert>{error.message}</FormAlert>}
        <Field label={label} required error={local ?? server?.field('reason')}>
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

function PointsModal({
  item,
  mode,
  pending,
  error,
  onClose,
  onSubmit,
}: {
  item: ManagedCompetition
  mode: 'verify' | 'points'
  pending: boolean
  error: Error | null
  onClose: () => void
  onSubmit: (points: RatingPoint[]) => void
}) {
  const defaults = useRatingDefaults()
  const fallback = defaults.data?.find((row) => row.level.id === item.contest_level.id)?.rating_points
  const [edited, setEdited] = useState<RatingPoint[] | null>(item.rating_points ?? null)
  const points = edited ?? fallback ?? []
  const server = error instanceof ApiError ? error : null

  return (
    <Modal
      open
      size="lg"
      onClose={pending ? () => {} : onClose}
      title={mode === 'verify' ? 'Верифицировать соревнование' : 'Баллы за места'}
      description={`${item.title} · ${item.contest_level.name}. Баллы пойдут в рейтинг участников по дисциплине и группе`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Отмена
          </Button>
          <Button loading={pending} disabled={!points.length} onClick={() => onSubmit(points)}>
            {mode === 'verify' ? 'Верифицировать' : 'Сохранить баллы'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error && !server?.field('rating_points') && <FormAlert>{error.message}</FormAlert>}
        {defaults.isPending && !item.rating_points ? (
          <Skeleton className="h-40 rounded-lg" />
        ) : (
          <>
            {!edited && fallback && (
              <p className="text-sm text-muted">По умолчанию для уровня «{item.contest_level.name}»</p>
            )}
            <RatingPointsEditor value={points} onChange={setEdited} error={server?.field('rating_points')} />
          </>
        )}
      </div>
    </Modal>
  )
}

function HistoryModal({ item, onClose }: { item: ManagedCompetition; onClose: () => void }) {
  const history = useCompetitionHistory(item.id, true)
  return (
    <Modal open onClose={onClose} size="lg" title="История" description={item.title}>
      {history.isPending ? (
        <Skeleton className="h-48 rounded-lg" />
      ) : history.isError ? (
        <ErrorState error={history.error} onRetry={() => history.refetch()} />
      ) : (
        <ol className="flex flex-col divide-y divide-line-soft">
          {history.data.map((entry) => (
            <li key={entry.id} className="flex flex-col gap-1 py-3">
              <span className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-body text-ink">
                  {entry.kind === 'verification' ? 'Верификация: ' : ''}
                  {entry.from_value ? `${valueTitles[entry.from_value] ?? entry.from_value} → ` : ''}
                  {valueTitles[entry.to_value] ?? entry.to_value}
                </span>
                <span className="font-mono text-xs text-muted">{formatDateTime(entry.created_at)}</span>
              </span>
              {entry.user && (
                <span className="text-sm text-muted">
                  {entry.user.last_name} {entry.user.first_name}
                </span>
              )}
              {entry.comment && <span className="text-sm text-muted">{entry.comment}</span>}
            </li>
          ))}
        </ol>
      )}
    </Modal>
  )
}
