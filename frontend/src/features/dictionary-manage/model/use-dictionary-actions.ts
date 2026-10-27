import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  dictionaryApi,
  dictionaryKeys,
  type AnyDictionaryItem,
  type DictionaryItemInput,
  type DictionaryKey,
} from '@/entities/dictionary'
import { showToast } from '@/shared/ui'

/** Все действия над записями справочника. После каждого — свежий список, без ручной правки кеша */
export function useDictionaryActions(key: DictionaryKey) {
  const client = useQueryClient()
  const refresh = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: dictionaryKeys.list(key) }),
      client.invalidateQueries({ queryKey: dictionaryKeys.options(key) }),
    ])

  const create = useMutation({
    mutationFn: (body: DictionaryItemInput) => dictionaryApi.create(key, body),
    onSuccess: (item) => {
      void refresh()
      showToast(`«${item.name}» добавлено`, { tone: 'success' })
    },
  })

  const update = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Partial<DictionaryItemInput> }) =>
      dictionaryApi.update(key, id, body),
    onSuccess: () => {
      void refresh()
      showToast('Изменения сохранены', { tone: 'success' })
    },
  })

  const restore = useMutation({
    mutationFn: (item: AnyDictionaryItem) => dictionaryApi.restore(key, item.id),
    onSuccess: (item) => {
      void refresh()
      showToast(`«${item.name}» снова доступно для выбора`, { tone: 'success' })
    },
    onError: (error) => showToast('Не удалось восстановить', { tone: 'danger', description: error.message }),
  })

  const archive = useMutation({
    mutationFn: (item: AnyDictionaryItem) => dictionaryApi.archive(key, item.id),
    onSuccess: (item) => {
      void refresh()
      showToast(`«${item.name}» в архиве`, {
        description: 'Из выбора скрыто, в старых записях осталось',
        action: { label: 'Вернуть', onClick: () => restore.mutate(item) },
      })
    },
    onError: (error) => showToast('Не удалось архивировать', { tone: 'danger', description: error.message }),
  })

  const remove = useMutation({
    mutationFn: (item: AnyDictionaryItem) => dictionaryApi.remove(key, item.id),
    onSuccess: (_, item) => {
      void refresh()
      showToast(`«${item.name}» удалено`, { tone: 'success' })
    },
  })

  return { create, update, archive, restore, remove }
}

export type DictionaryActions = ReturnType<typeof useDictionaryActions>
