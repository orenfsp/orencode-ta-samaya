import { useState } from 'react'
import { Link } from 'react-router'
import type { Competition } from '@/entities/competition'
import {
  documentApi,
  useContestDocuments,
  type DocumentGroup,
  type DocumentKind,
  type DocumentScope,
} from '@/entities/document'
import { DocumentsModal, kindOrder, useDocumentActions } from '@/features/documents-issue'
import { routes } from '@/shared/config'
import { formatDate, plural } from '@/shared/lib'
import {
  Button,
  ConfirmModal,
  ErrorState,
  IconButton,
  IconDots,
  IconDownload,
  IconPlus,
  IconRefresh,
  IconTrash,
  Menu,
  PlaceMark,
  Skeleton,
} from '@/shared/ui'

const ISSUABLE = new Set(['in_progress', 'completed', 'archived'])
const SHOWN = 8

function Group({
  group,
  contestId,
  manage,
}: {
  group: DocumentGroup
  contestId: number
  manage?: { reissue: () => void; remove: () => void }
}) {
  const [all, setAll] = useState(false)
  const count = group.items.length
  const items = all ? group.items : group.items.slice(0, SHOWN)
  return (
    <li className="flex flex-col gap-3 px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <span className="text-body text-ink">{group.kind_title}</span>
          <span className="text-sm text-muted">
            {count} {plural(count, ['документ', 'документа', 'документов'])} · выданы{' '}
            {formatDate(group.form.issued_on)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<IconDownload size={18} />}
            href={documentApi.kindPdfUrl(contestId, group.kind)}
          >
            PDF
          </Button>
          {manage && (
            <Menu
              align="end"
              aria-label={`Действия: ${group.kind_title}`}
              items={[
                {
                  id: 'reissue',
                  label: 'Выпустить заново',
                  icon: <IconRefresh size={18} />,
                  onSelect: manage.reissue,
                },
                { id: 'remove', label: 'Убрать', icon: <IconTrash size={18} />, onSelect: manage.remove },
              ]}
              trigger={(props) => (
                <IconButton
                  {...props}
                  aria-label={`Действия: ${group.kind_title}`}
                  data-no-tooltip
                  icon={<IconDots size={18} />}
                  size="sm"
                />
              )}
            />
          )}
        </div>
      </div>
      <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
        {items.map((item) => (
          <li key={item.token}>
            <Link
              to={routes.document(item.token)}
              className="flex min-w-0 items-center gap-3 rounded-md py-1.5 text-sm hover:text-primary-text"
            >
              {item.place ? (
                <PlaceMark place={item.place} size="sm" />
              ) : (
                <span className="w-7 shrink-0" aria-hidden="true" />
              )}
              <span className="truncate text-ink">{item.name}</span>
              <span className="truncate text-muted">
                {item.role === 'coach'
                  ? 'тренер'
                  : item.role === 'judge'
                    ? 'судья'
                    : item.team
                      ? `«${item.team}»`
                      : ''}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {count > SHOWN && (
        <Button variant="text" size="sm" className="self-start" onClick={() => setAll((value) => !value)}>
          {all ? 'Свернуть' : `Показать все ${count}`}
        </Button>
      )}
    </li>
  )
}

/**
 * Документы соревнования — публично: у каждого свой QR и страница проверки.
 * Владелец и федерация выпускают, перевыпускают и убирают их здесь же.
 */
export function DocumentsSection({ item, scope }: { item: Competition; scope: DocumentScope | null }) {
  const documents = useContestDocuments(item.id)
  const actions = useDocumentActions(scope ?? 'admin', item.id)
  const [modal, setModal] = useState<{ open: boolean; key: number; kind: DocumentKind }>({
    open: false,
    key: 0,
    kind: 'certificate',
  })
  const [removing, setRemoving] = useState<DocumentGroup | null>(null)
  const groups = documents.data ?? []
  const manager = scope !== null && ISSUABLE.has(item.status)
  const open = (kind: DocumentKind) => setModal((state) => ({ open: true, key: state.key + 1, kind }))
  const nextKind = kindOrder.find((kind) => !groups.some((group) => group.kind === kind)) ?? 'certificate'

  if (!manager && (documents.isPending || documents.isError || !groups.length)) return null

  return (
    <section className="flex flex-col gap-4" aria-busy={documents.isFetching}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-h3 font-medium">Документы</h2>
        {manager && (
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<IconPlus size={18} />}
            onClick={() => open(nextKind)}
          >
            Выпустить документы
          </Button>
        )}
      </div>

      {documents.isPending ? (
        <Skeleton className="h-40 rounded-lg" />
      ) : documents.isError ? (
        <ErrorState error={documents.error} onRetry={() => documents.refetch()} />
      ) : !groups.length ? (
        <p className="rounded-lg border border-line-soft px-5 py-6 text-sm text-muted">
          Сертификаты, дипломы, грамоты, благодарности тренерам и справки ещё не выпущены
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-line-soft overflow-hidden rounded-lg border border-line-soft">
          {groups.map((group) => (
            <Group
              key={group.kind}
              group={group}
              contestId={item.id}
              manage={
                manager ? { reissue: () => open(group.kind), remove: () => setRemoving(group) } : undefined
              }
            />
          ))}
        </ul>
      )}

      {scope && (
        <>
          <DocumentsModal
            key={modal.key}
            scope={scope}
            contest={item}
            groups={groups}
            initialKind={modal.kind}
            actions={actions}
            open={modal.open}
            onClose={() => setModal((state) => ({ ...state, open: false }))}
          />
          <ConfirmModal
            open={removing !== null}
            onClose={() => setRemoving(null)}
            onConfirm={async () => {
              if (removing) await actions.remove.mutateAsync(removing.kind).catch(() => undefined)
              setRemoving(null)
            }}
            title={removing ? `Убрать: ${removing.kind_title.toLowerCase()}` : ''}
            description="Документы исчезнут со страницы соревнования, их QR-коды перестанут открываться"
            confirmLabel="Убрать"
            tone="danger"
          />
        </>
      )}
    </section>
  )
}
