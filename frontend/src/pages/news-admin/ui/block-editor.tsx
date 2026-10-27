import type { ReactNode } from 'react'
import { blockTitles, NewsCover, type Block, type BlockType } from '@/entities/news'
import {
  Button,
  Field,
  FileDrop,
  IconButton,
  IconChevronDown,
  IconChevronUp,
  IconFile,
  IconHeading,
  IconImage,
  IconLink,
  IconText,
  IconTrash,
  Input,
  Spinner,
  Tabs,
  Textarea,
  type IconProps,
} from '@/shared/ui'
import type { Uploads } from './use-upload'

const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp'
const FILE_ACCEPT = '.pdf,.docx,.xlsx,.zip'

const blockIcons: Record<BlockType, (props: IconProps) => ReactNode> = {
  heading: IconHeading,
  text: IconText,
  image: IconImage,
  file: IconFile,
  link: IconLink,
}

/** Один блок статьи: сверху тип и перемещение, ниже — поля своего типа */
export function BlockEditor({
  block,
  index,
  count,
  slot,
  uploads,
  error,
  onChange,
  onMove,
  onRemove,
}: {
  block: Block
  index: number
  count: number
  /** Ключ загрузки этого блока — чтобы крутилка была только у него */
  slot: string
  uploads: Uploads
  error?: string
  onChange: (block: Block) => void
  onMove: (offset: number) => void
  onRemove: () => void
}) {
  const Icon = blockIcons[block.type]

  return (
    <li className="flex flex-col gap-4 rounded-xl border border-line-soft bg-surface p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <Icon size={18} className="text-muted" />
        <span className="flex-1 text-sm text-muted">
          {blockTitles[block.type]} <span className="font-mono">· {index + 1}</span>
        </span>
        <IconButton
          aria-label="Выше"
          size="sm"
          icon={<IconChevronUp size={18} />}
          disabled={index === 0}
          onClick={() => onMove(-1)}
        />
        <IconButton
          aria-label="Ниже"
          size="sm"
          icon={<IconChevronDown size={18} />}
          disabled={index === count - 1}
          onClick={() => onMove(1)}
        />
        <IconButton aria-label="Удалить блок" size="sm" icon={<IconTrash size={18} />} onClick={onRemove} />
      </div>

      {block.type === 'heading' && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field label="Заголовок раздела" className="flex-1" error={error}>
            <Input
              maxLength={200}
              value={block.text}
              onChange={(event) => onChange({ ...block, text: event.target.value })}
            />
          </Field>
          <Tabs
            aria-label="Размер заголовка"
            value={String(block.level)}
            onChange={(value) => onChange({ ...block, level: Number(value) as 2 | 3 })}
            items={[
              { value: '2', label: 'Крупный' },
              { value: '3', label: 'Средний' },
            ]}
          />
        </div>
      )}

      {block.type === 'text' && (
        <Field label="Текст" error={error}>
          <Textarea
            autoGrow
            minRows={4}
            maxLength={20000}
            value={block.text}
            onChange={(event) => onChange({ ...block, text: event.target.value })}
          />
        </Field>
      )}

      {block.type === 'image' && (
        <>
          {block.file_id ? (
            <div className="flex flex-col gap-2">
              <NewsCover fileId={block.file_id} alt={block.alt ?? ''} className="rounded-lg" />
              <Button
                variant="text"
                size="sm"
                className="self-start"
                onClick={() => onChange({ ...block, file_id: '' })}
              >
                Заменить изображение
              </Button>
            </div>
          ) : (
            <Upload
              label="Изображение"
              hint="JPEG, PNG или WebP, до 10 МБ"
              accept={IMAGE_ACCEPT}
              loading={uploads.loading(slot)}
              error={error}
              onFile={(file) => uploads.upload(slot, file, (id) => onChange({ ...block, file_id: id }))}
            />
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Подпись" hint="Видна под картинкой">
              <Input
                maxLength={500}
                value={block.caption ?? ''}
                onChange={(event) => onChange({ ...block, caption: event.target.value || null })}
              />
            </Field>
            <Field label="Текст для скринридера" hint="Что изображено, коротко">
              <Input
                maxLength={200}
                value={block.alt ?? ''}
                onChange={(event) => onChange({ ...block, alt: event.target.value || null })}
              />
            </Field>
          </div>
        </>
      )}

      {block.type === 'file' && (
        <>
          {block.file_id ? (
            <div className="flex items-center gap-3 rounded-lg border border-line-soft px-4 py-3">
              <IconFile size={20} className="shrink-0 text-muted" />
              <span className="min-w-0 flex-1 truncate text-body text-ink">
                {uploads.name(block.file_id) ?? 'Файл прикреплён'}
              </span>
              <Button variant="text" size="sm" onClick={() => onChange({ ...block, file_id: '' })}>
                Заменить
              </Button>
            </div>
          ) : (
            <Upload
              label="Файл"
              hint="PDF, DOCX, XLSX или ZIP, до 10 МБ"
              accept={FILE_ACCEPT}
              loading={uploads.loading(slot)}
              error={error}
              onFile={(file) =>
                uploads.upload(slot, file, (id) =>
                  onChange({
                    ...block,
                    file_id: id,
                    title: block.title || file.name.replace(/\.[^.]+$/, ''),
                  }),
                )
              }
            />
          )}
          <Field label="Название" error={block.file_id ? error : undefined} hint="Подпись файла в статье">
            <Input
              maxLength={200}
              value={block.title}
              onChange={(event) => onChange({ ...block, title: event.target.value })}
            />
          </Field>
        </>
      )}

      {block.type === 'link' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Адрес" error={error}>
            <Input
              type="url"
              maxLength={2048}
              placeholder="https://"
              value={block.url}
              onChange={(event) => onChange({ ...block, url: event.target.value })}
            />
          </Field>
          <Field label="Текст ссылки" hint="Без текста покажем адрес">
            <Input
              maxLength={200}
              value={block.title}
              onChange={(event) => onChange({ ...block, title: event.target.value })}
            />
          </Field>
        </div>
      )}
    </li>
  )
}

function Upload({
  label,
  hint,
  accept,
  loading,
  error,
  onFile,
}: {
  label: string
  hint: string
  accept: string
  loading: boolean
  error?: string
  onFile: (file: File) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <FileDrop
        label={label}
        hint={hint}
        accept={accept}
        value={null}
        onChange={(file) => file && onFile(file)}
        error={error}
      />
      {loading && (
        <span className="flex items-center gap-2 text-sm text-muted">
          <Spinner className="size-4" /> Загружаем…
        </span>
      )}
    </div>
  )
}

/** Добавить блок в конец статьи: пять типов одной строкой */
export function AddBlockBar({ disabled, onAdd }: { disabled: boolean; onAdd: (type: BlockType) => void }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-dashed border-line p-4">
      <span className="text-sm text-muted">Добавить блок</span>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(blockTitles) as BlockType[]).map((type) => {
          const Icon = blockIcons[type]
          return (
            <Button
              key={type}
              variant="secondary"
              size="sm"
              disabled={disabled}
              leftIcon={<Icon size={16} />}
              onClick={() => onAdd(type)}
            >
              {blockTitles[type]}
            </Button>
          )
        })}
      </div>
    </div>
  )
}
