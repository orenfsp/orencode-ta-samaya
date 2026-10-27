import { useState } from 'react'
import type { AnyDictionaryItem } from '@/entities/dictionary'
import { ApiError } from '@/shared/api'
import {
  ConfirmModal,
  IconArchive,
  IconButton,
  IconDots,
  IconPencil,
  IconRefresh,
  IconTrash,
  Menu,
  showToast,
} from '@/shared/ui'
import type { DictionaryActions } from '../model/use-dictionary-actions'

/** Меню строки справочника и подтверждения. Удаление используемого значения бэк запрещает — тогда предлагаем архив */
export function ItemActions({
  item,
  actions,
  onEdit,
}: {
  item: AnyDictionaryItem
  actions: DictionaryActions
  onEdit: () => void
}) {
  const [confirm, setConfirm] = useState<'delete' | 'in-use' | null>(null)

  const remove = async () => {
    try {
      await actions.remove.mutateAsync(item)
    } catch (error) {
      if (error instanceof ApiError && error.code === 'in_use') {
        setConfirm('in-use')
        return
      }
      showToast('Не удалось удалить', { tone: 'danger', description: (error as Error).message })
    }
  }

  return (
    <>
      <Menu
        align="end"
        aria-label={`Действия: ${item.name}`}
        items={[
          { id: 'edit', label: 'Изменить', icon: <IconPencil size={18} />, onSelect: onEdit },
          item.is_archived
            ? {
                id: 'restore',
                label: 'Вернуть из архива',
                icon: <IconRefresh size={18} />,
                onSelect: () => actions.restore.mutate(item),
              }
            : {
                id: 'archive',
                label: 'В архив',
                description: 'Скрыть из выбора, старые записи сохранятся',
                icon: <IconArchive size={18} />,
                onSelect: () => actions.archive.mutate(item),
              },
          {
            id: 'delete',
            label: 'Удалить',
            icon: <IconTrash size={18} />,
            onSelect: () => setConfirm('delete'),
          },
        ]}
        trigger={(props) => (
          <IconButton
            {...props}
            aria-label={`Действия: ${item.name}`}
            data-no-tooltip
            icon={<IconDots size={18} />}
            size="sm"
          />
        )}
      />

      <ConfirmModal
        open={confirm === 'delete'}
        onClose={() => setConfirm((current) => (current === 'delete' ? null : current))}
        onConfirm={remove}
        title={`Удалить «${item.name}»?`}
        description="Запись удалится насовсем. Если значение уже используется, его можно только отправить в архив."
        confirmLabel="Удалить"
        tone="danger"
      />

      <ConfirmModal
        open={confirm === 'in-use'}
        onClose={() => setConfirm(null)}
        onConfirm={() => actions.archive.mutateAsync(item).then(() => undefined)}
        title="Значение уже используется"
        description={`«${item.name}» встречается в других данных, поэтому удалить его нельзя. Можно отправить в архив: из выбора оно пропадёт, а старые записи останутся как были.`}
        confirmLabel="Отправить в архив"
      />
    </>
  )
}
