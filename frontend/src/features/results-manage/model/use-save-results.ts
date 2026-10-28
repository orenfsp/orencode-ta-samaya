import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ratingKeys } from '@/entities/rating'
import { resultApi, resultKeys, type PlaceInput, type ResultsScope } from '@/entities/result'
import { showToast } from '@/shared/ui'

/** Места пересоздаются целиком: после сохранения обновляем таблицу соревнования и рейтинги */
export function useSaveResults(scope: ResultsScope, contestId: number) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ items, source }: { items: PlaceInput[]; source?: string }) =>
      resultApi.save(scope, contestId, items, source),
    onSuccess: (form) => {
      client.setQueryData(resultKeys.form(scope, contestId), form)
      void client.invalidateQueries({ queryKey: resultKeys.contest(contestId) })
      void client.invalidateQueries({ queryKey: ratingKeys.all })
      showToast('Места сохранены', { tone: 'success' })
    },
  })
}
