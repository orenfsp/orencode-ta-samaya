import { useState, type FormEvent } from 'react'
import type { WallEntry, WallRole } from '@/entities/person'
import { ApiError } from '@/shared/api'
import { Button, Field, FormAlert, Modal, Switch, Textarea } from '@/shared/ui'
import { MAX_POST_PHOTOS, MAX_POST_TEXT } from '../model/form'
import type { WallActions } from '../model/use-wall-actions'
import { PhotoPicker, type PickedPhoto } from './photo-picker'

/** Текст и фото к соревнованию в ленте. Черновик берётся из поста при монтировании: страница меняет key на открытии */
export function PostEditModal({
  open,
  role,
  entry,
  actions,
  onClose,
}: {
  open: boolean
  role: WallRole
  entry: WallEntry | null
  actions: WallActions
  onClose: () => void
}) {
  const post = entry?.post
  const [text, setText] = useState(post?.text ?? '')
  const [photos, setPhotos] = useState<PickedPhoto[]>(post?.photos ?? [])
  const [hidden, setHidden] = useState(post?.is_hidden ?? false)
  const mutation = actions.savePost
  const error = mutation.error instanceof ApiError ? mutation.error : null

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!entry) return
    mutation.mutate(
      {
        role,
        contestId: entry.contest.id,
        body: { text: text.trim() || null, photo_ids: photos.map((photo) => photo.id), is_hidden: hidden },
      },
      { onSuccess: onClose },
    )
  }

  const general =
    error && !Object.keys(error.fields).length
      ? error.message
      : mutation.isError && !error
        ? 'Не получилось сохранить. Проверьте соединение'
        : null

  return (
    <Modal
      size="md"
      open={open}
      onClose={onClose}
      onSubmit={submit}
      title={post ? 'Пост' : 'Новый пост'}
      description={entry?.contest.title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" loading={mutation.isPending}>
            Сохранить
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {general && <FormAlert>{general}</FormAlert>}
        <Field label="Текст" hint={`${text.length} из ${MAX_POST_TEXT}`} error={error?.field('text')}>
          <Textarea
            rows={6}
            maxLength={MAX_POST_TEXT}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Как прошло, что решали, что получилось"
          />
        </Field>
        <PhotoPicker
          label="Фото"
          max={MAX_POST_PHOTOS}
          value={photos}
          onChange={setPhotos}
          error={error?.field('photo_ids')}
        />
        <Switch
          label="Скрыть пост"
          description="Его увидите только вы и федерация"
          checked={hidden}
          onChange={(event) => setHidden(event.target.checked)}
        />
      </div>
    </Modal>
  )
}
