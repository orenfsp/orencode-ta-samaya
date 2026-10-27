import { useMutation } from '@tanstack/react-query'
import type { CompetitionFile } from '@/entities/competition'
import { fileApi, fileKind, formatFileSize } from '@/entities/file'
import { cn } from '@/shared/lib'
import {
  buttonClass,
  FileDrop,
  IconButton,
  IconChevronLeft,
  IconChevronRight,
  IconClose,
  IconDownload,
  IconFile,
  Spinner,
} from '@/shared/ui'
import { DOCUMENT_ACCEPT, IMAGE_ACCEPT, MAX_PHOTOS } from '../model/form'

/** Файл загружается сразу после выбора; в соревнование уходит только его id */
function useUpload(onUploaded: (file: CompetitionFile) => void) {
  return useMutation({ mutationFn: fileApi.upload, onSuccess: onUploaded })
}

/** Документ по киту §6: иконка, название, тип и размер */
export function DocumentRow({ file, onRemove }: { file: CompetitionFile; onRemove?: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-line-soft bg-surface-2 px-4 py-3 light:bg-surface-3">
      <IconFile size={22} className="shrink-0 text-muted" />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-body text-ink">{file.original_name}</span>
        <span className="font-mono text-xs text-muted">
          {fileKind(file.content_type)} · {formatFileSize(file.size)}
        </span>
      </div>
      <a
        href={file.url}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonClass({ variant: 'ghost', size: 'sm' })}
      >
        <IconDownload size={16} /> Открыть
      </a>
      {onRemove && (
        <IconButton
          aria-label="Убрать положение"
          icon={<IconClose size={18} />}
          size="sm"
          onClick={onRemove}
        />
      )}
    </div>
  )
}

export function RegulationsField({
  value,
  onChange,
  error,
}: {
  value: CompetitionFile | null
  onChange: (file: CompetitionFile | null) => void
  error?: string
}) {
  const upload = useUpload(onChange)
  if (value) return <DocumentRow file={value} onRemove={() => onChange(null)} />
  return (
    <div className="flex flex-col gap-2">
      <FileDrop
        label="Положение о соревновании"
        hint="PDF или DOCX, до 10 МБ"
        accept={DOCUMENT_ACCEPT}
        value={upload.isPending ? (upload.variables ?? null) : null}
        onChange={(file) => file && upload.mutate(file)}
        error={error ?? (upload.isError ? upload.error.message : undefined)}
      />
      {upload.isPending && (
        <span className="flex items-center gap-2 text-sm text-muted">
          <Spinner className="size-4" /> Загружаем…
        </span>
      )}
    </div>
  )
}

/** До 10 фото без обложки: порядок здесь = порядок в галерее */
export function PhotosField({
  value,
  onChange,
  error,
}: {
  value: CompetitionFile[]
  onChange: (files: CompetitionFile[]) => void
  error?: string
}) {
  const upload = useUpload((file) => onChange([...value, file]))
  const move = (index: number, offset: number) => {
    const next = [...value]
    const [photo] = next.splice(index, 1)
    next.splice(index + offset, 0, photo!)
    onChange(next)
  }

  return (
    <div className="flex flex-col gap-3">
      {value.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {value.map((photo, index) => (
            <li key={photo.id} className="flex flex-col gap-1.5">
              <img
                src={photo.url}
                alt={`Фото ${index + 1}`}
                className="aspect-video w-full rounded-md border border-line-soft object-cover"
              />
              <div className="flex items-center gap-1">
                <span className="mr-auto font-mono text-xs text-muted">{index + 1}</span>
                <IconButton
                  aria-label="Сдвинуть раньше"
                  icon={<IconChevronLeft size={16} />}
                  size="sm"
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                />
                <IconButton
                  aria-label="Сдвинуть позже"
                  icon={<IconChevronRight size={16} />}
                  size="sm"
                  disabled={index === value.length - 1}
                  onClick={() => move(index, 1)}
                />
                <IconButton
                  aria-label="Убрать фото"
                  icon={<IconClose size={16} />}
                  size="sm"
                  onClick={() => onChange(value.filter((item) => item.id !== photo.id))}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
      {value.length < MAX_PHOTOS ? (
        <FileDrop
          label={`Фото · ${value.length} из ${MAX_PHOTOS}`}
          hint="JPEG, PNG или WebP, до 10 МБ"
          accept={IMAGE_ACCEPT}
          value={upload.isPending ? (upload.variables ?? null) : null}
          onChange={(file) => file && upload.mutate(file)}
          error={error ?? (upload.isError ? upload.error.message : undefined)}
          className={cn(upload.isPending && 'pointer-events-none opacity-60')}
        />
      ) : (
        <p className="text-sm text-muted">Больше {MAX_PHOTOS} фото добавить нельзя</p>
      )}
      {upload.isPending && (
        <span className="flex items-center gap-2 text-sm text-muted">
          <Spinner className="size-4" /> Загружаем фото…
        </span>
      )}
    </div>
  )
}
