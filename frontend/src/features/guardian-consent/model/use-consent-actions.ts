import { useMutation, useQueryClient } from '@tanstack/react-query'
import { auditKeys } from '@/entities/audit'
import { consentApi, consentKeys, type ConsentInput } from '@/entities/consent'
import { showToast } from '@/shared/ui'

/** Подать согласие, одобрить или отклонить. После каждого — свежие очередь, счётчик и своё согласие */
export function useConsentActions() {
  const client = useQueryClient()
  const refresh = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: consentKeys.all }),
      client.invalidateQueries({ queryKey: auditKeys.all }),
    ])

  const submit = useMutation({
    mutationFn: (body: ConsentInput) => consentApi.submit(body),
    onSuccess: () => {
      void refresh()
      showToast('Согласие отправлено на проверку', { tone: 'success' })
    },
  })
  const approve = useMutation({
    mutationFn: (id: string) => consentApi.approve(id),
    onSuccess: (item) => {
      void refresh()
      showToast('Согласие одобрено', { tone: 'success', description: item.person.full_name })
    },
    onError: (error) => showToast(error.message, { tone: 'danger' }),
  })
  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => consentApi.reject(id, reason),
    onSuccess: (item) => {
      void refresh()
      showToast('Согласие отклонено', { tone: 'success', description: item.person.full_name })
    },
  })
  return { submit, approve, reject }
}

export type ConsentActions = ReturnType<typeof useConsentActions>
