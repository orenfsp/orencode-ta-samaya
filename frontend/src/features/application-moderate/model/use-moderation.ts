import { useMutation, useQueryClient } from '@tanstack/react-query'
import { applicationApi, applicationKeys, type ModerationScope } from '@/entities/application'
import { plural } from '@/shared/lib'
import { showToast } from '@/shared/ui'

const count = (n: number) => `${n} ${plural(n, ['заявка', 'заявки', 'заявок'])}`

/** Решения по заявкам участников. Массовые — «всё или ничего» на сервере */
export function useModeration(scope: ModerationScope) {
  const client = useQueryClient()
  const refresh = () => client.invalidateQueries({ queryKey: applicationKeys.all })
  const fail = (title: string) => (error: Error) =>
    showToast(title, { tone: 'danger', description: error.message })

  const approve = useMutation({
    mutationFn: (ids: number[]) => applicationApi.approve(scope, ids),
    onSuccess: (_, ids) => {
      void refresh()
      showToast(ids.length > 1 ? `Одобрено: ${count(ids.length)}` : 'Заявка одобрена', { tone: 'success' })
    },
    onError: fail('Не получилось одобрить'),
  })

  const reject = useMutation({
    mutationFn: ({ ids, reason }: { ids: number[]; reason: string }) =>
      applicationApi.reject(scope, ids, reason),
    onSuccess: (_, { ids }) => {
      void refresh()
      showToast(ids.length > 1 ? `Отклонено: ${count(ids.length)}` : 'Заявка отклонена', { tone: 'success' })
    },
  })

  const reset = useMutation({
    mutationFn: (id: number) => applicationApi.reset(scope, id),
    onSuccess: () => {
      void refresh()
      showToast('Заявка снова на рассмотрении', { tone: 'success' })
    },
    onError: fail('Не получилось вернуть на рассмотрение'),
  })

  return { approve, reject, reset }
}

export type Moderation = ReturnType<typeof useModeration>
