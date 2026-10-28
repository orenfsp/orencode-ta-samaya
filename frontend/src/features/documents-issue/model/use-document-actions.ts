import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  documentApi,
  documentKeys,
  type DocumentForm,
  type DocumentKind,
  type DocumentScope,
} from '@/entities/document'
import { plural } from '@/shared/lib'
import { showToast } from '@/shared/ui'
import { kindLabels, saveSigner } from './presets'

/** Выпуск заменяет документы вида целиком: старые ссылки и QR перестают работать */
export function useDocumentActions(scope: DocumentScope, contestId: number) {
  const client = useQueryClient()
  const refresh = () => client.invalidateQueries({ queryKey: documentKeys.all })

  const issue = useMutation({
    mutationFn: ({ kind, form }: { kind: DocumentKind; form: DocumentForm }) =>
      documentApi.issue(scope, contestId, kind, form),
    onSuccess: (page, { kind, form }) => {
      saveSigner(form)
      void refresh()
      const count = page.items.find((group) => group.kind === kind)?.items.length ?? 0
      showToast(`${kindLabels[kind]}: ${count} ${plural(count, ['документ', 'документа', 'документов'])}`, {
        tone: 'success',
      })
    },
  })

  const remove = useMutation({
    mutationFn: (kind: DocumentKind) => documentApi.remove(scope, contestId, kind),
    onSuccess: (_, kind) => {
      void refresh()
      showToast(`${kindLabels[kind]} убраны`, { tone: 'success' })
    },
    onError: (error) => showToast('Не получилось убрать', { tone: 'danger', description: error.message }),
  })

  return { issue, remove }
}

export type DocumentActions = ReturnType<typeof useDocumentActions>
