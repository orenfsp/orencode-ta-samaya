import type { ReactNode } from 'react'
import { Button, DataTable, EmptyState, ErrorState, Pagination, type Column } from '@/shared/ui'
import { PAGE } from './use-params'

/** Таблица реестра: строки, пустое состояние, страницы «N–M из K» и выгрузка тех же фильтров в xlsx */
export function RegistryTable<T>({
  caption,
  columns,
  query,
  rowKey,
  page,
  onPage,
  filtered,
  onReset,
  onRowClick,
}: {
  caption: string
  columns: Column<T>[]
  query: {
    data?: { items: T[]; total: number }
    isPending: boolean
    isError: boolean
    error: Error | null
    refetch: () => unknown
  }
  rowKey: (row: T) => string
  page: number
  onPage: (page: number) => void
  filtered: boolean
  onReset: () => void
  onRowClick?: (row: T) => void
}): ReactNode {
  const total = query.data?.total ?? 0
  if (query.isError && !query.data) return <ErrorState error={query.error} onRetry={() => query.refetch()} />
  return (
    <div className="flex flex-col gap-4">
      <DataTable
        caption={caption}
        columns={columns}
        rows={query.data?.items ?? []}
        rowKey={rowKey}
        loading={query.isPending}
        onRowClick={onRowClick}
        empty={
          <EmptyState
            title="Никого не нашли"
            description={filtered ? 'Измените поиск или сбросьте фильтры' : 'В реестре пока пусто'}
            action={
              filtered ? (
                <Button variant="secondary" onClick={onReset}>
                  Сбросить фильтры
                </Button>
              ) : undefined
            }
          />
        }
      />
      {!query.isPending && (
        <p className="font-mono text-sm text-muted tabular-nums">
          {query.data?.items.length ?? 0} из {total}
        </p>
      )}
      {total > PAGE && (
        <div className="flex flex-col items-center gap-2">
          <Pagination page={page} totalPages={Math.ceil(total / PAGE)} onPage={onPage} />
          <span className="font-mono text-sm text-muted tabular-nums">
            {(page - 1) * PAGE + 1}–{Math.min(page * PAGE, total)} из {total}
          </span>
        </div>
      )}
    </div>
  )
}
