import { useState } from 'react'
import {
  actionLabel,
  canCancel,
  canDelete,
  canEdit,
  isPublic,
  statusActions,
  useRatingDefaults,
  type CompetitionAction,
  type CompetitionScope,
  type ManagedCompetition,
  type RatingPoint,
} from '@/entities/competition'
import { ApiError } from '@/shared/api'
import { routes } from '@/shared/config'
import {
  Button,
  ConfirmModal,
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
  ReasonModal,
  Skeleton,
  type MenuItem,
} from '@/shared/ui'
import type { CompetitionActions } from '../model/use-competition-actions'
import { transitionConfirmation } from '../model/transition-confirmation'
import { RatingPointsEditor } from './rating-points-editor'

type Dialog = 'cancel' | 'delete' | 'verify' | 'points' | 'reject' | 'revoke' | null

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
  const [transition, setTransition] = useState<CompetitionAction | null>(null)
  const [requesting, setRequesting] = useState(false)
  // Последнее открытое окно остаётся в DOM, пока закрывается: так у него есть анимация выхода.
  // Каждое новое открытие — новый ключ, чтобы форма начиналась с чистого листа
  const [shown, setShown] = useState<{ dialog: Dialog; key: number }>({ dialog: null, key: 0 })
  if (dialog && dialog !== shown.dialog) setShown({ dialog, key: shown.key + 1 })
  const admin = scope === 'admin'
  const verification = item.verification_status
  const close = () => setDialog(null)

  const items: MenuItem[] = [
    ...(canEdit(item.status)
      ? [{ id: 'edit', label: 'Изменить', icon: <IconPencil size={18} />, onSelect: onEdit }]
      : []),
    ...statusActions[item.status]
      .filter((action) => action !== 'publish')
      .map((action) => ({
        id: action,
        label: actionLabel(action, item.status),
        icon: <IconArrowRight size={18} />,
        onSelect: () => setTransition(action),
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
            onSelect: () => setRequesting(true),
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

      <TransitionConfirm
        item={item}
        action={transition}
        actions={actions}
        onClose={() => setTransition(null)}
      />
      <ConfirmModal
        open={requesting}
        onClose={() => setRequesting(false)}
        onConfirm={async () => {
          await actions.requestVerification.mutateAsync(item)
        }}
        title="Отправить соревнование на верификацию?"
        description={`«${item.title}». Федерация получит запрос на проверку и настройку баллов за места.`}
        confirmLabel="Отправить запрос"
      />

      <ReasonModal
        open={dialog === 'cancel'}
        tone="danger"
        title={`Отменить «${item.title}»?`}
        description="Соревнование останется в календаре со статусом «Отменено» и причиной"
        label="Причина отмены"
        confirmLabel="Отменить соревнование"
        pending={actions.cancel.isPending}
        error={actions.cancel.error}
        onClose={close}
        onSubmit={(reason) => actions.cancel.mutate({ item, reason }, { onSuccess: close })}
      />
      <ReasonModal
        open={dialog === 'reject'}
        title="Отказать в верификации?"
        description={`Организатор увидит причину и сможет запросить верификацию снова`}
        label="Причина отказа"
        confirmLabel="Отказать"
        pending={actions.reject.isPending}
        error={actions.reject.error}
        onClose={close}
        onSubmit={(reason) => actions.reject.mutate({ item, reason }, { onSuccess: close })}
      />
      {(shown.dialog === 'verify' || shown.dialog === 'points') && (
        <PointsModal
          key={shown.key}
          open={dialog === shown.dialog}
          item={item}
          mode={shown.dialog}
          pending={shown.dialog === 'verify' ? actions.verify.isPending : actions.setPoints.isPending}
          error={shown.dialog === 'verify' ? actions.verify.error : actions.setPoints.error}
          onClose={close}
          onSubmit={(points) =>
            (shown.dialog === 'verify' ? actions.verify : actions.setPoints).mutate(
              { item, points },
              { onSuccess: close },
            )
          }
        />
      )}

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

function PointsModal({
  open,
  item,
  mode,
  pending,
  error,
  onClose,
  onSubmit,
}: {
  open: boolean
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
      open={open}
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

/** Публикация черновика с карточки после явного подтверждения. */
export function PublishCompetitionButton({
  item,
  actions,
}: {
  item: ManagedCompetition
  actions: CompetitionActions
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      {item.status === 'draft' && (
        <Button
          variant="primary"
          size="sm"
          disabled={actions.transition.isPending}
          onClick={() => setOpen(true)}
        >
          Опубликовать
        </Button>
      )}
      <TransitionConfirm
        item={item}
        action={open ? 'publish' : null}
        actions={actions}
        onClose={() => setOpen(false)}
      />
    </>
  )
}

function TransitionConfirm({
  item,
  action,
  actions,
  onClose,
}: {
  item: ManagedCompetition
  action: CompetitionAction | null
  actions: CompetitionActions
  onClose: () => void
}) {
  const details = transitionConfirmation[action ?? 'publish']
  return (
    <ConfirmModal
      open={action !== null}
      onClose={onClose}
      onConfirm={async () => {
        if (action) await actions.transition.mutateAsync({ item, action })
      }}
      title={details.title}
      description={`«${item.title}». ${details.description}`}
      confirmLabel={actionLabel(action ?? 'publish', item.status)}
    />
  )
}
