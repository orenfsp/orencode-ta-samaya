import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  applicationApi,
  applicationKeys,
  type Application,
  type ApplicationInput,
} from '@/entities/application'
import { ApiError } from '@/shared/api'
import { plural } from '@/shared/lib'
import { showToast } from '@/shared/ui'

type Action = 'submit' | 'withdraw' | 'confirm' | 'decline'

const done: Record<Action, string> = {
  submit: 'Заявка подана на рассмотрение',
  withdraw: 'Заявка отозвана',
  confirm: 'Участие подтверждено',
  decline: 'Вы отказались от участия',
}

/** Сообщения о составе с сервера: «Белова Мария: уже заявлена…» — списком над формой */
export function memberProblems(error: unknown) {
  if (!(error instanceof ApiError)) return error instanceof Error ? [error.message] : []
  const lines = ['members', 'member_ids', 'user_id', 'ids'].flatMap((name) => error.fields[name] ?? [])
  return lines.length ? lines : error.fields.team_name ? [] : [error.message]
}

/** Все действия участника и тренера с заявками. После каждого — свежие списки и календарь */
export function useApplicationActions() {
  const client = useQueryClient()
  const refresh = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: applicationKeys.all }),
      client.invalidateQueries({ queryKey: ['calendar'] }),
    ])

  const create = useMutation({
    mutationFn: ({ contestId, body }: { contestId: number; body: ApplicationInput }) =>
      applicationApi.create(contestId, body),
    onSuccess: (item) => {
      void refresh()
      showToast(
        item.status === 'submitted'
          ? 'Заявка подана на рассмотрение'
          : 'Заявка создана, участники получили приглашения',
        { tone: 'success' },
      )
    },
  })

  const createForAthletes = useMutation({
    mutationFn: ({ contestId, memberIds }: { contestId: number; memberIds: string[] }) =>
      applicationApi.createForAthletes(contestId, memberIds),
    onSuccess: (page) => {
      void refresh()
      const count = page.items.length
      showToast(`Записано: ${count} ${plural(count, ['спортсмен', 'спортсмена', 'спортсменов'])}`, {
        tone: 'success',
        description: 'Каждый получил приглашение. Заявка уйдёт организатору, когда спортсмен подтвердит',
      })
    },
  })

  const rename = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) => applicationApi.rename(id, name),
    onSuccess: () => {
      void refresh()
      showToast('Название команды сохранено', { tone: 'success' })
    },
  })

  const addMember = useMutation({
    mutationFn: ({ id, userId }: { id: number; userId: string }) => applicationApi.addMember(id, userId),
    onSuccess: () => {
      void refresh()
      showToast('Приглашение отправлено', { tone: 'success' })
    },
  })

  const removeMember = useMutation({
    mutationFn: ({ id, userId }: { id: number; userId: string }) => applicationApi.removeMember(id, userId),
    onSuccess: () => void refresh(),
    onError: (error) =>
      showToast('Не получилось убрать участника', { tone: 'danger', description: error.message }),
  })

  const act = useMutation({
    mutationFn: ({ item, action }: { item: Application; action: Action }) =>
      applicationApi.act(item.id, action),
    onSuccess: (_, { action }) => {
      void refresh()
      showToast(done[action], { tone: 'success' })
    },
  })

  return { create, createForAthletes, rename, addMember, removeMember, act }
}

export type ApplicationActions = ReturnType<typeof useApplicationActions>
