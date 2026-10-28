import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import {
  linkActionLabels,
  linkActions,
  linkTone,
  sportProfileApi,
  sportProfileKeys,
  type CoachLink,
  type CoachLinkAction,
} from '@/entities/sport-profile'
import { formatDate, formatOrenburgDateTime } from '@/shared/lib'
import { Button, Facts, FormAlert, Modal, StatusTag, Textarea, showToast } from '@/shared/ui'

/** Связь тренера и спортсмена: кто, дисциплина, статус, история изменений и действия по статусу */
export function LinkDetailsModal({
  open,
  link,
  asAthlete,
  onClose,
}: {
  open: boolean
  link: CoachLink | null
  asAthlete: boolean
  onClose: () => void
}) {
  const client = useQueryClient()
  const [comment, setComment] = useState('')
  const move = useMutation({
    mutationFn: (action: CoachLinkAction) =>
      sportProfileApi.move(link!.id, action, comment.trim() || undefined),
    onSuccess: (data) => {
      void client.invalidateQueries({ queryKey: sportProfileKeys.links })
      void client.invalidateQueries({ queryKey: sportProfileKeys.profile })
      showToast(data.status_title, { tone: 'success' })
      onClose()
    },
  })
  const actions = link ? linkActions(link.status, asAthlete) : []
  const other = link && (asAthlete ? link.coach : link.athlete)

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={other?.name ?? 'Связь'}
      description={link ? `${asAthlete ? 'Тренер' : 'Спортсмен'} · ${link.discipline.name}` : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Закрыть
          </Button>
          {actions.map((action) => (
            <Button
              key={action}
              variant={action === 'accept' || action === 'resume' ? 'primary' : 'secondary'}
              loading={move.isPending && move.variables === action}
              disabled={move.isPending}
              onClick={() => move.mutate(action)}
            >
              {linkActionLabels[action]}
            </Button>
          ))}
        </>
      }
    >
      {link && (
        <div className="flex flex-col gap-5">
          <Facts
            layout="row"
            items={[
              {
                label: 'Статус',
                value: <StatusTag tone={linkTone[link.status]}>{link.status_title}</StatusTag>,
              },
              { label: 'Дисциплина', value: link.discipline.name },
              { label: 'С', value: formatDate(link.created_at) },
            ]}
          />
          <section className="flex flex-col gap-2">
            <h3 className="font-medium">История</h3>
            <ol className="flex flex-col divide-y divide-line-soft rounded-lg border border-line-soft">
              {link.events.map((event, index) => (
                <li key={index} className="flex flex-col gap-0.5 px-4 py-2.5">
                  <span className="text-ink">
                    {event.status_title}
                    {event.actor && <span className="text-muted"> · {event.actor}</span>}
                  </span>
                  <span className="font-mono text-xs text-muted tabular-nums">
                    {formatOrenburgDateTime(event.created_at)}
                  </span>
                  {event.comment && <span className="text-sm text-ink">{event.comment}</span>}
                </li>
              ))}
            </ol>
          </section>
          {actions.length > 0 && (
            <Textarea
              aria-label="Комментарий к действию"
              placeholder="Комментарий, если нужно"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              maxLength={500}
              minRows={2}
            />
          )}
          {move.isError && <FormAlert>{move.error.message}</FormAlert>}
        </div>
      )}
    </Modal>
  )
}
