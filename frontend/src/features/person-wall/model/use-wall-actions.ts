import { useMutation, useQueryClient } from '@tanstack/react-query'
import { personApi, personKeys, type PageInput, type PostInput, type WallRole } from '@/entities/person'
import { showToast } from '@/shared/ui'

/** Пост и настройки страницы владельца, скрытие поста федерацией. После каждого действия — свежая лента */
export function useWallActions() {
  const client = useQueryClient()
  const refresh = () => client.invalidateQueries({ queryKey: personKeys.all })

  const savePost = useMutation({
    mutationFn: ({ role, contestId, body }: { role: WallRole; contestId: number; body: PostInput }) =>
      personApi.savePost(role, contestId, body),
    onSuccess: () => {
      void refresh()
      showToast('Пост сохранён', { tone: 'success' })
    },
  })

  const updatePage = useMutation({
    mutationFn: (body: PageInput) => personApi.updatePage(body),
    onSuccess: () => {
      void refresh()
      showToast('Настройки сохранены', { tone: 'success' })
    },
  })

  const moderate = useMutation({
    mutationFn: ({ id, hidden }: { id: string; hidden: boolean }) => personApi.moderatePost(id, hidden),
    onSuccess: (_, { hidden }) => {
      void refresh()
      showToast(hidden ? 'Пост скрыт' : 'Пост снова виден', { tone: 'success' })
    },
  })

  return { savePost, updatePage, moderate }
}

export type WallActions = ReturnType<typeof useWallActions>
