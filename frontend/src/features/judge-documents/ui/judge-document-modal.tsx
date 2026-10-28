import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { fileApi } from '@/entities/file'
import {
  judgeDocumentApi,
  judgeDocumentKeys,
  judgeDocumentKinds,
  type JudgeDocument,
  type JudgeDocumentKind,
} from '@/entities/judge-document'
import { ApiError } from '@/shared/api'
import { Button, Field, FileDrop, FormAlert, Modal, Select, Spinner, Textarea, showToast } from '@/shared/ui'

const ACCEPT =
  'application/pdf,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx,image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp'

/** Добавить или заменить свой документ к протоколу. Без item — новый документ */
export function JudgeDocumentModal({
  open,
  contestId,
  item,
  onClose,
}: {
  open: boolean
  contestId: number
  item: JudgeDocument | null
  onClose: () => void
}) {
  const client = useQueryClient()
  const [kind, setKind] = useState<JudgeDocumentKind>(item?.kind ?? 'note')
  const [file, setFile] = useState<{ id: string; name: string } | null>(null)
  const [comment, setComment] = useState(item?.comment ?? '')
  const [missing, setMissing] = useState<string | null>(null)

  const upload = useMutation({
    mutationFn: fileApi.upload,
    onSuccess: (stored) => setFile({ id: stored.id, name: stored.original_name }),
  })
  const save = useMutation({
    mutationFn: () => {
      const body = { kind, comment: comment.trim() || undefined, file_id: file?.id }
      return item
        ? judgeDocumentApi.replace(item.id, body)
        : judgeDocumentApi.upload(contestId, { ...body, file_id: file!.id })
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: judgeDocumentKeys.contest(contestId) })
      showToast(item ? 'Документ заменён' : 'Документ добавлен', { tone: 'success' })
      onClose()
    },
  })

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!item && !file) return setMissing('Приложите файл')
    setMissing(null)
    save.mutate()
  }

  const error = save.error instanceof ApiError ? save.error : null
  const current = file?.name ?? item?.file_name

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={item ? 'Заменить документ' : 'Документ к протоколу'}
      description="Файл сразу виден на странице соревнования рядом с протоколом"
      onSubmit={onSubmit}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" loading={save.isPending} disabled={upload.isPending}>
            Сохранить
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <Field label="Вид" required>
          <Select
            value={kind}
            onChange={(event) => setKind(event.target.value as JudgeDocumentKind)}
            options={judgeDocumentKinds}
          />
        </Field>
        <div className="flex flex-col gap-2">
          {current && !upload.isPending ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-line-soft px-4 py-3">
              <span className="truncate text-ink">{current}</span>
              <Button variant="text" size="sm" onClick={() => setFile(null)} disabled={!file}>
                {file ? 'Убрать' : 'Текущий файл'}
              </Button>
            </div>
          ) : null}
          {!file && (
            <FileDrop
              label={item ? 'Новый файл, если нужно заменить' : 'Файл'}
              hint="PDF, DOCX или фото, до 10 МБ"
              accept={ACCEPT}
              value={upload.isPending ? (upload.variables ?? null) : null}
              onChange={(picked) => picked && upload.mutate(picked)}
              error={
                missing ?? error?.field('file_id') ?? (upload.isError ? upload.error.message : undefined)
              }
            />
          )}
          {upload.isPending && (
            <span className="flex items-center gap-2 text-sm text-muted">
              <Spinner className="size-4" /> Загружаем…
            </span>
          )}
        </div>
        <Field label="Комментарий" error={error?.field('comment')}>
          <Textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            maxLength={500}
            minRows={2}
          />
        </Field>
        {save.isError && !error?.field('file_id') && !error?.field('comment') && (
          <FormAlert>{save.error.message}</FormAlert>
        )}
      </div>
    </Modal>
  )
}
