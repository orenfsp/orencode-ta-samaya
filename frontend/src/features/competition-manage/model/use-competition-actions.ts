import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  competitionApi,
  competitionKeys,
  type CompetitionAction,
  type CompetitionInput,
  type CompetitionScope,
  type ManagedCompetition,
  type RatingPoint,
} from '@/entities/competition'
import { showToast } from '@/shared/ui'

const fail = (title: string) => (error: Error) =>
  showToast(title, { tone: 'danger', description: error.message })

/** Все действия над соревнованиями раздела. После каждого — свежие списки соревнований и календаря */
export function useCompetitionActions(scope: CompetitionScope) {
  const client = useQueryClient()
  const refresh = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: competitionKeys.all }),
      client.invalidateQueries({ queryKey: ['calendar'] }),
    ])

  const create = useMutation({
    mutationFn: (body: CompetitionInput) => competitionApi.create(scope, body),
    onSuccess: (item) => {
      void refresh()
      showToast(`«${item.title}» сохранено как черновик`, { tone: 'success' })
    },
  })

  const update = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Partial<CompetitionInput> }) =>
      competitionApi.update(scope, id, body),
    onSuccess: (item, { id }) => {
      void refresh()
      showToast('Изменения сохранены', {
        tone: 'success',
        description:
          item.verification_status === 'pending' && scope === 'organizer'
            ? 'Изменены поля, влияющие на рейтинг: верификация снова на проверке'
            : undefined,
      })
      void client.invalidateQueries({ queryKey: competitionKeys.detail(id) })
    },
  })

  const transition = useMutation({
    mutationFn: ({ item, action }: { item: ManagedCompetition; action: CompetitionAction }) =>
      competitionApi.transition(scope, item.id, action),
    onSuccess: (item) => {
      void refresh()
      showToast(`Статус: ${item.status_title.toLowerCase()}`, { tone: 'success' })
    },
    onError: fail('Не получилось сменить статус'),
  })

  const cancel = useMutation({
    mutationFn: ({ item, reason }: { item: ManagedCompetition; reason: string }) =>
      competitionApi.cancel(scope, item.id, reason),
    onSuccess: (item) => {
      void refresh()
      showToast(`«${item.title}» отменено`, { tone: 'success' })
    },
  })

  const remove = useMutation({
    mutationFn: (item: ManagedCompetition) => competitionApi.remove(scope, item.id),
    onSuccess: (_, item) => {
      void refresh()
      showToast(`«${item.title}» удалено`, { tone: 'success' })
    },
  })

  const requestVerification = useMutation({
    mutationFn: (item: ManagedCompetition) => competitionApi.requestVerification(item.id),
    onSuccess: () => {
      void refresh()
      showToast('Запрос на верификацию отправлен', {
        tone: 'success',
        description: 'Федерация проверит соревнование и настроит баллы за места',
      })
    },
    onError: fail('Не получилось отправить запрос'),
  })

  const verify = useMutation({
    mutationFn: ({ item, points }: { item: ManagedCompetition; points: RatingPoint[] }) =>
      competitionApi.verify(item.id, points),
    onSuccess: (item) => {
      void refresh()
      showToast(`«${item.title}» верифицировано`, { tone: 'success' })
    },
  })

  const setPoints = useMutation({
    mutationFn: ({ item, points }: { item: ManagedCompetition; points: RatingPoint[] }) =>
      competitionApi.setRatingPoints(item.id, points),
    onSuccess: () => {
      void refresh()
      showToast('Баллы за места сохранены', { tone: 'success' })
    },
  })

  const reject = useMutation({
    mutationFn: ({ item, reason }: { item: ManagedCompetition; reason: string }) =>
      competitionApi.rejectVerification(item.id, reason),
    onSuccess: () => {
      void refresh()
      showToast('В верификации отказано', { tone: 'success' })
    },
  })

  const revoke = useMutation({
    mutationFn: (item: ManagedCompetition) => competitionApi.revokeVerification(item.id),
    onSuccess: () => {
      void refresh()
      showToast('Верификация снята', { description: 'Соревнование больше не влияет на рейтинг' })
    },
    onError: fail('Не получилось снять верификацию'),
  })

  return {
    create,
    update,
    transition,
    cancel,
    remove,
    requestVerification,
    verify,
    setPoints,
    reject,
    revoke,
  }
}

export type CompetitionActions = ReturnType<typeof useCompetitionActions>
