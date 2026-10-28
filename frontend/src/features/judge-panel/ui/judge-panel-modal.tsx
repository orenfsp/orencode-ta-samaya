import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useDictionaryOptions } from '@/entities/dictionary'
import {
  qualificationApi,
  qualificationKeys,
  useJudgeCandidates,
  useJudgePanel,
  type JudgeAssignment,
  type JudgePanel,
} from '@/entities/qualification'
import { ApiError } from '@/shared/api'
import { formatDate } from '@/shared/lib'
import {
  Button,
  ConfirmModal,
  EmptyState,
  ErrorState,
  Field,
  FormAlert,
  IconAlert,
  IconButton,
  IconTrash,
  Modal,
  SearchSelect,
  Select,
  Skeleton,
  showToast,
} from '@/shared/ui'

function categoryLine(item: { category: JudgeAssignment['category'] }) {
  if (!item.category) return 'Нет категории на дату соревнования'
  return item.category.valid_until
    ? `${item.category.name}, до ${formatDate(item.category.valid_until)}`
    : item.category.name
}

/** Конфликт интересов: судья — тренер участников этого соревнования. Назначить можно, решение остаётся в журнале */
function ConflictLine({ names }: { names: string[] }) {
  return (
    <span className="flex items-start gap-1.5 text-sm text-live-text">
      <IconAlert size={16} className="mt-0.5 shrink-0" />
      Тренер участников: {names.slice(0, 3).join(', ')}
      {names.length > 3 ? ` и ещё ${names.length - 3}` : ''}
    </span>
  )
}

/**
 * Судейская коллегия соревнования: кто судит и в какой должности.
 * Назначить можно только судью, у которого категория действует на дату начала.
 */
export function JudgePanelModal({
  open,
  contest,
  onClose,
}: {
  open: boolean
  contest: { id: number; title: string }
  onClose: () => void
}) {
  const client = useQueryClient()
  const panel = useJudgePanel(contest.id, open)
  const candidates = useJudgeCandidates(contest.id, '', open)
  const positions = useDictionaryOptions('judge_positions')
  const [judge, setJudge] = useState<string | null>(null)
  const [position, setPosition] = useState('')
  const [removing, setRemoving] = useState<{ open: boolean; item: JudgeAssignment | null }>({
    open: false,
    item: null,
  })

  const store = (data: JudgePanel) => {
    client.setQueryData(qualificationKeys.panel(contest.id), data)
    void client.invalidateQueries({ queryKey: qualificationKeys.judges })
  }
  const assign = useMutation({
    mutationFn: () => qualificationApi.assign(contest.id, judge!, Number(position)),
    onSuccess: (data) => {
      store(data)
      setJudge(null)
      showToast('Судья назначен', { tone: 'success' })
    },
  })
  const move = useMutation({
    mutationFn: ({ id, positionId }: { id: string; positionId: number }) =>
      qualificationApi.move(contest.id, id, positionId),
    onSuccess: store,
    onError: (error) =>
      showToast('Не получилось сменить должность', { tone: 'danger', description: error.message }),
  })

  const positionOptions = (positions.data ?? []).map((item) => ({ value: String(item.id), label: item.name }))
  const eligible = (candidates.data ?? []).filter((item) => item.category)
  const blocked = (candidates.data ?? []).length - eligible.length
  const error = assign.error instanceof ApiError ? assign.error : null

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (judge && position) assign.mutate()
  }

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="Судейская коллегия"
        description={
          panel.data ? `${contest.title} · начало ${formatDate(panel.data.starts_on)}` : contest.title
        }
        size="xl"
        onSubmit={onSubmit}
        footer={
          <Button variant="ghost" onClick={onClose}>
            Закрыть
          </Button>
        }
      >
        <div className="flex flex-col gap-8">
          {panel.isPending ? (
            <div className="flex flex-col gap-2">
              {[1, 2].map((id) => (
                <Skeleton key={id} className="h-16 rounded-lg" />
              ))}
            </div>
          ) : panel.isError ? (
            <ErrorState error={panel.error} onRetry={() => panel.refetch()} />
          ) : !panel.data.items.length ? (
            <EmptyState title="Коллегия не назначена" description="Назначьте главного судью и судей ниже" />
          ) : (
            <ul className="flex flex-col divide-y divide-line-soft overflow-hidden rounded-lg border border-line-soft">
              {panel.data.items.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:px-5"
                >
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-ink">{item.judge.name}</span>
                    <span className="text-sm text-muted">{categoryLine(item)}</span>
                    {item.conflicts.length > 0 && <ConflictLine names={item.conflicts} />}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-full sm:w-56">
                      <Select
                        aria-label={`Должность: ${item.judge.name}`}
                        value={String(item.position.id)}
                        options={positionOptions}
                        disabled={move.isPending}
                        onChange={(event) =>
                          move.mutate({ id: item.id, positionId: Number(event.target.value) })
                        }
                      />
                    </div>
                    <IconButton
                      aria-label={`Снять: ${item.judge.name}`}
                      icon={<IconTrash size={18} />}
                      onClick={() => setRemoving({ open: true, item })}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}

          <section className="flex flex-col gap-4">
            <h3 className="font-medium">Назначить судью</h3>
            <div className="grid gap-4 sm:grid-cols-[1fr_16rem_auto] sm:items-end">
              <Field
                label="Судья"
                hint={
                  blocked ? `Без категории на дату соревнования: ${blocked}. Их назначить нельзя` : undefined
                }
                error={error?.field('judge_id')}
              >
                <SearchSelect
                  value={judge}
                  onChange={setJudge}
                  placeholder="Фамилия или почта"
                  emptyText={candidates.isPending ? 'Загружаем…' : 'Нет судей с действующей категорией'}
                  options={eligible.map((item) => ({
                    value: item.judge.id,
                    label: item.judge.name,
                    description: item.conflicts.length
                      ? `${categoryLine(item)} · тренер участников: ${item.conflicts.length}`
                      : categoryLine(item),
                  }))}
                />
              </Field>
              <Field label="Должность" error={error?.field('position_id')}>
                <Select
                  value={position}
                  onChange={(event) => setPosition(event.target.value)}
                  placeholder="Выберите"
                  options={positionOptions}
                />
              </Field>
              <Button type="submit" loading={assign.isPending} disabled={!judge || !position}>
                Назначить
              </Button>
            </div>
            {assign.isError && !error?.field('judge_id') && !error?.field('position_id') && (
              <FormAlert>{assign.error.message}</FormAlert>
            )}
          </section>
        </div>
      </Modal>

      <ConfirmModal
        open={removing.open}
        onClose={() => setRemoving((current) => ({ ...current, open: false }))}
        title="Снять судью"
        description={removing.item ? `${removing.item.judge.name} получит уведомление о снятии` : undefined}
        confirmLabel="Снять"
        tone="danger"
        onConfirm={async () => {
          if (!removing.item) return
          try {
            store(await qualificationApi.remove(contest.id, removing.item.id))
            setRemoving((current) => ({ ...current, open: false }))
          } catch (failure) {
            showToast('Не получилось снять', { tone: 'danger', description: (failure as Error).message })
          }
        }}
      />
    </>
  )
}
