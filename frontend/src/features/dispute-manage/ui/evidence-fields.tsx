import { useMutation } from '@tanstack/react-query'
import { fileApi } from '@/entities/file'
import { Field, FileDrop, IconButton, IconClose, Input, Spinner } from '@/shared/ui'
import type { Evidence } from '../model/evidence'

/** Доказательства: файлы (логи, скриншоты, PDF, архив) и ссылка на видео или облако */
export function EvidenceFields({
  value,
  onChange,
  urlError,
  filesError,
}: {
  value: Evidence
  onChange: (next: Evidence) => void
  urlError?: string
  filesError?: string
}) {
  const upload = useMutation({
    mutationFn: fileApi.upload,
    onSuccess: (stored) =>
      onChange({ ...value, files: [...value.files, { id: stored.id, name: stored.original_name }] }),
  })

  return (
    <div className="flex flex-col gap-4">
      {value.files.length > 0 && (
        <ul className="flex flex-col gap-2">
          {value.files.map((file) => (
            <li
              key={file.id}
              className="flex items-center justify-between gap-3 rounded-md bg-surface-2 px-3 py-2"
            >
              <span className="truncate text-sm text-ink">{file.name}</span>
              <IconButton
                size="sm"
                aria-label={`Убрать ${file.name}`}
                icon={<IconClose size={16} />}
                onClick={() =>
                  onChange({ ...value, files: value.files.filter((item) => item.id !== file.id) })
                }
              />
            </li>
          ))}
        </ul>
      )}
      {value.files.length < 10 && (
        <FileDrop
          label="Доказательства"
          hint="Логи, скриншоты, PDF, архив — до 10 файлов по 10 МБ"
          accept="image/jpeg,image/png,image/webp,application/pdf,.pdf,.docx,.xlsx,.zip"
          value={null}
          onChange={(picked) => picked && upload.mutate(picked)}
          error={filesError ?? (upload.isError ? upload.error.message : undefined)}
        />
      )}
      {upload.isPending && (
        <span className="flex items-center gap-2 text-sm text-muted">
          <Spinner className="size-4" /> Загружаем…
        </span>
      )}
      <Field
        label="Ссылка на видео или облако"
        hint="Видео не загружается файлом — дайте ссылку"
        error={urlError}
      >
        <Input
          type="url"
          inputMode="url"
          placeholder="https://"
          maxLength={500}
          value={value.url}
          onChange={(event) => onChange({ ...value, url: event.target.value })}
        />
      </Field>
    </div>
  )
}
