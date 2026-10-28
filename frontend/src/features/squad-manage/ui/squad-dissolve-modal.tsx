import { useMutation, useQueryClient } from '@tanstack/react-query'
import { squadApi, squadKeys, type Squad } from '@/entities/squad'
import { formatDate } from '@/shared/lib'
import { ConfirmModal, showToast } from '@/shared/ui'

/** Расформирование: состав и приказ удаляются, метки у участников пропадают */
export function SquadDissolveModal({
  open,
  squad,
  onClose,
}: {
  open: boolean
  squad: Squad | null
  onClose: () => void
}) {
  const client = useQueryClient()
  const dissolve = useMutation({
    mutationFn: (id: number) => squadApi.dissolve(id),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: squadKeys.all })
      showToast('Сборная расформирована', { tone: 'success' })
    },
    onError: (error) =>
      showToast('Не получилось расформировать', { tone: 'danger', description: error.message }),
  })

  return (
    <ConfirmModal
      open={open}
      onClose={onClose}
      onConfirm={async () => {
        if (squad) await dissolve.mutateAsync(squad.id).catch(() => undefined)
      }}
      title="Расформировать сборную"
      description={
        squad
          ? `Состав по приказу № ${squad.order.number} от ${formatDate(squad.order.date)} и сам приказ удалятся. Метки у участников пропадут`
          : undefined
      }
      confirmLabel="Расформировать"
      tone="danger"
    />
  )
}
