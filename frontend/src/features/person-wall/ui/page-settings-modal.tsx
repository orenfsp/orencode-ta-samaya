import { useState, type FormEvent } from 'react'
import type { Person } from '@/entities/person'
import { ApiError } from '@/shared/api'
import { Avatar, Button, FormAlert, Modal } from '@/shared/ui'
import type { WallActions } from '../model/use-wall-actions'
import { PhotoPicker, type PickedPhoto } from './photo-picker'

/** Фото на странице человека. Черновик — из страницы при монтировании, key меняется на открытии */
export function PageSettingsModal({
  open,
  person,
  actions,
  onClose,
}: {
  open: boolean
  person: Person
  actions: WallActions
  onClose: () => void
}) {
  const [avatar, setAvatar] = useState<PickedPhoto | null>(
    person.avatar_url ? { id: '', url: person.avatar_url } : null,
  )
  const mutation = actions.updatePage
  const error = mutation.error instanceof ApiError ? mutation.error : null
  const avatarChanged = avatar ? avatar.id !== '' : person.avatar_url != null

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!avatarChanged) return onClose()
    mutation.mutate({ avatar_file_id: avatar?.id ?? null }, { onSuccess: onClose })
  }

  return (
    <Modal
      size="md"
      open={open}
      onClose={onClose}
      onSubmit={submit}
      title="Фото на странице"
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
      <div className="flex flex-col gap-6">
        {error && !error.field('avatar_file_id') && <FormAlert>{error.message}</FormAlert>}
        <div className="flex flex-col gap-3">
          {avatar ? (
            <div className="flex items-center gap-4">
              <Avatar name={person.name} src={avatar.url} size="lg" />
              <Button variant="secondary" size="sm" onClick={() => setAvatar(null)}>
                Убрать
              </Button>
            </div>
          ) : (
            <PhotoPicker
              label="Фото для аватара"
              max={1}
              value={[]}
              onChange={(photos) => setAvatar(photos[0] ?? null)}
              error={error?.field('avatar_file_id')}
            />
          )}
        </div>
      </div>
    </Modal>
  )
}
