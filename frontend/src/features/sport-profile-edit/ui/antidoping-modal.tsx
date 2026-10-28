import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { fileApi } from '@/entities/file'
import { sportProfileApi, sportProfileKeys } from '@/entities/sport-profile'
import { ApiError } from '@/shared/api'
import { orenburgDay } from '@/shared/lib'
import { Button, DateInput, Field, FileDrop, FormAlert, Input, Modal, Spinner, showToast } from '@/shared/ui'

const ACCEPT = 'application/pdf,.pdf,image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp'

/** Отметка об онлайн-курсе РУСАДА: дата, ссылка на сертификат или файл. Срок — год */
export function AntidopingModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const client = useQueryClient()
  const [passedOn, setPassedOn] = useState(orenburgDay(new Date()))
  const [url, setUrl] = useState('')
  const [file, setFile] = useState<{ id: string; name: string } | null>(null)
  const upload = useMutation({
    mutationFn: fileApi.upload,
    onSuccess: (stored) => setFile({ id: stored.id, name: stored.original_name }),
  })
  const save = useMutation({
    mutationFn: () =>
      sportProfileApi.addAntidoping({
        passed_on: passedOn,
        certificate_url: url.trim() || undefined,
        file_id: file?.id,
      }),
    onSuccess: (data) => {
      client.setQueryData(sportProfileKeys.profile, data)
      showToast('Курс отмечен', { tone: 'success' })
      onClose()
    },
  })
  const error = save.error instanceof ApiError ? save.error : null

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    save.mutate()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title="Антидопинговый курс РУСАДА"
      description="Сертификат онлайн-курса действует год"
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
        <Field label="Дата прохождения" required error={error?.field('passed_on')}>
          <DateInput value={passedOn} onChange={setPassedOn} max={orenburgDay(new Date())} />
        </Field>
        <Field label="Ссылка на сертификат" error={error?.field('certificate_url')}>
          <Input
            type="url"
            placeholder="https://"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
          />
        </Field>
        {file ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-line-soft px-4 py-3">
            <span className="truncate text-ink">{file.name}</span>
            <Button variant="text" size="sm" onClick={() => setFile(null)}>
              Убрать
            </Button>
          </div>
        ) : (
          <FileDrop
            label="Или файл сертификата"
            hint="PDF или фото"
            accept={ACCEPT}
            value={upload.isPending ? (upload.variables ?? null) : null}
            onChange={(picked) => picked && upload.mutate(picked)}
            error={error?.field('file_id') ?? (upload.isError ? upload.error.message : undefined)}
          />
        )}
        {upload.isPending && (
          <span className="flex items-center gap-2 text-sm text-muted">
            <Spinner className="size-4" /> Загружаем…
          </span>
        )}
        {save.isError && !Object.keys(error?.fields ?? {}).length && (
          <FormAlert>{save.error.message}</FormAlert>
        )}
      </div>
    </Modal>
  )
}
