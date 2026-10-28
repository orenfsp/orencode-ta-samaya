import { useMutation } from '@tanstack/react-query'
import { fileApi } from '@/entities/file'
import { cn } from '@/shared/lib'
import { FileDrop, IconButton, IconClose, Spinner } from '@/shared/ui'
import { IMAGE_ACCEPT } from '../model/form'

export interface PickedPhoto {
  id: string
  url: string
}

/** Фото загружаются сразу после выбора; в пост уходят только id */
export function PhotoPicker({
  value,
  onChange,
  max,
  label,
  error,
}: {
  value: PickedPhoto[]
  onChange: (photos: PickedPhoto[]) => void
  max: number
  label: string
  error?: string
}) {
  const upload = useMutation({
    mutationFn: fileApi.upload,
    onSuccess: (file) => onChange([...value, { id: file.id, url: file.url }]),
  })

  return (
    <div className="flex flex-col gap-3">
      {value.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {value.map((photo, index) => (
            <li key={photo.id} className="relative">
              <img
                src={photo.url}
                alt={`Фото ${index + 1}`}
                className="aspect-video w-full rounded-md border border-line-soft bg-surface-3 object-cover"
              />
              <IconButton
                aria-label="Убрать фото"
                icon={<IconClose size={16} />}
                size="sm"
                variant="secondary"
                className="absolute top-1.5 right-1.5"
                onClick={() => onChange(value.filter((item) => item.id !== photo.id))}
              />
            </li>
          ))}
        </ul>
      )}
      {value.length < max ? (
        <FileDrop
          label={max > 1 ? `${label} · ${value.length} из ${max}` : label}
          hint="JPEG, PNG или WebP, до 10 МБ"
          accept={IMAGE_ACCEPT}
          value={upload.isPending ? (upload.variables ?? null) : null}
          onChange={(file) => file && upload.mutate(file)}
          error={error ?? (upload.isError ? upload.error.message : undefined)}
          className={cn(upload.isPending && 'pointer-events-none opacity-60')}
        />
      ) : (
        max > 1 && <p className="text-sm text-muted">Больше {max} фото добавить нельзя</p>
      )}
      {upload.isPending && (
        <span className="flex items-center gap-2 text-sm text-muted">
          <Spinner className="size-4" /> Загружаем фото…
        </span>
      )}
    </div>
  )
}
