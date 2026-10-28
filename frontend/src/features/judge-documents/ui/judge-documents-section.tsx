import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { formatFileSize } from '@/entities/file'
import {
  judgeDocumentApi,
  judgeDocumentKeys,
  useJudgeDocuments,
  type JudgeDocument,
} from '@/entities/judge-document'
import { useJudgePanel } from '@/entities/qualification'
import { useMe } from '@/entities/session'
import { formatDate } from '@/shared/lib'
import {
  Button,
  ConfirmModal,
  ErrorState,
  IconButton,
  IconDownload,
  IconPencil,
  IconPlus,
  IconTrash,
  Skeleton,
  showToast,
} from '@/shared/ui'
import { JudgeDocumentModal } from './judge-document-modal'

const SHOWN = new Set(['in_progress', 'completed', 'archived'])
const OPEN = new Set(['in_progress', 'completed'])

/**
 * Документы судейской коллегии рядом с протоколом. Видны всем без проверки.
 * Судья коллегии добавляет свои, пока соревнование идёт или завершено; снятый судья — только читает.
 */
export function JudgeDocumentsSection({ contest }: { contest: { id: number; status: string } }) {
  const visible = SHOWN.has(contest.status)
  const documents = useJudgeDocuments(contest.id, visible)
  const panel = useJudgePanel(contest.id, visible)
  const { data: me } = useMe()
  const client = useQueryClient()
  const [form, setForm] = useState<{ open: boolean; item: JudgeDocument | null; key: number }>({
    open: false,
    item: null,
    key: 0,
  })
  const [removing, setRemoving] = useState<{ open: boolean; item: JudgeDocument | null }>({
    open: false,
    item: null,
  })

  if (!visible) return null
  const member = Boolean(me && panel.data?.items.some((item) => item.judge.id === me.id))
  const editable = member && OPEN.has(contest.status)
  const items = documents.data ?? []
  if (documents.isSuccess && !items.length && !editable) return null
  const open = (item: JudgeDocument | null) => setForm((state) => ({ open: true, item, key: state.key + 1 }))

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-h3 font-medium">Документы судейской коллегии</h2>
        {editable && (
          <Button variant="secondary" size="sm" leftIcon={<IconPlus size={18} />} onClick={() => open(null)}>
            Добавить документ
          </Button>
        )}
      </div>

      {documents.isPending ? (
        <Skeleton className="h-24 rounded-lg" />
      ) : documents.isError ? (
        <ErrorState error={documents.error} onRetry={() => documents.refetch()} />
      ) : !items.length ? (
        <p className="text-muted">Судьи ещё не приложили документы</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line-soft overflow-hidden rounded-lg border border-line-soft">
          {items.map((item) => {
            const own = editable && !item.removed && item.judge_id === me?.id
            return (
              <li key={item.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-5">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-ink">
                    {item.kind_title} · {item.judge_name}
                    {item.removed && <span className="text-muted"> · снят</span>}
                  </span>
                  <span className="text-sm text-muted">
                    {[
                      item.position,
                      `${item.file_name}, ${formatFileSize(item.file_size)}`,
                      formatDate(item.updated_at),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                  {item.comment && <span className="text-sm text-ink">{item.comment}</span>}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    leftIcon={<IconDownload size={18} />}
                    href={item.url}
                    external
                  >
                    Открыть
                  </Button>
                  {own && (
                    <>
                      <IconButton
                        aria-label="Заменить"
                        icon={<IconPencil size={18} />}
                        onClick={() => open(item)}
                      />
                      <IconButton
                        aria-label="Удалить"
                        icon={<IconTrash size={18} />}
                        onClick={() => setRemoving({ open: true, item })}
                      />
                    </>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <JudgeDocumentModal
        key={form.key}
        open={form.open}
        contestId={contest.id}
        item={form.item}
        onClose={() => setForm((state) => ({ ...state, open: false }))}
      />
      <ConfirmModal
        open={removing.open}
        onClose={() => setRemoving((state) => ({ ...state, open: false }))}
        title="Удалить документ"
        description={removing.item ? `${removing.item.kind_title}: ${removing.item.file_name}` : undefined}
        confirmLabel="Удалить"
        tone="danger"
        onConfirm={async () => {
          if (!removing.item) return
          try {
            await judgeDocumentApi.remove(removing.item.id)
            void client.invalidateQueries({ queryKey: judgeDocumentKeys.contest(contest.id) })
            setRemoving((state) => ({ ...state, open: false }))
          } catch (failure) {
            showToast('Не получилось удалить', { tone: 'danger', description: (failure as Error).message })
          }
        }}
      />
    </section>
  )
}
