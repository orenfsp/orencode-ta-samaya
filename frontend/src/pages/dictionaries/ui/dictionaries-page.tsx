import { useState } from 'react'
import { Navigate, NavLink, useNavigate, useParams } from 'react-router'
import {
  describeRules,
  DictionaryVisual,
  dictionaryKind,
  isDictionaryMock,
  useDictionaryCatalog,
  useDictionaryItems,
  type AnyDictionaryItem,
  type DictionaryInfo,
  type DictionaryKey,
} from '@/entities/dictionary'
import { ItemActions, ItemFormDrawer, QuickAdd, useDictionaryActions } from '@/features/dictionary-manage'
import { routes } from '@/shared/config'
import { cn, plural } from '@/shared/lib'
import {
  MetaTag,
  StatusTag,
  Button,
  EmptyState,
  ErrorState,
  FormAlert,
  IconPlus,
  IconSearch,
  Input,
  PageHeader,
  Select,
  Skeleton,
  Switch,
} from '@/shared/ui'

/** Сравнение без регистра и «ё»: «королев» находит «Королёв» */
const normalize = (text: string) => text.toLowerCase().replaceAll('ё', 'е')

export function DictionariesPage() {
  const { key } = useParams()
  const catalog = useDictionaryCatalog()

  if (catalog.isPending) return <DictionariesSkeleton />
  if (catalog.isError) return <ErrorState error={catalog.error} onRetry={() => catalog.refetch()} />

  const current = catalog.data.find((item) => item.key === key)
  if (!current) return <Navigate to={routes.dictionaries(catalog.data[0]?.key)} replace />

  // key по справочнику: поиск, архив и форма сбрасываются при переходе к другому
  return <DictionaryView key={current.key} catalog={catalog.data} current={current} />
}

function DictionaryView({ catalog, current }: { catalog: DictionaryInfo[]; current: DictionaryInfo }) {
  const navigate = useNavigate()
  const items = useDictionaryItems(current.key)
  const actions = useDictionaryActions(current.key)
  const [query, setQuery] = useState('')
  const [showArchive, setShowArchive] = useState(false)
  const [form, setForm] = useState<{ open: boolean; item: AnyDictionaryItem | null; session: number }>({
    open: false,
    item: null,
    session: 0,
  })
  const kind = dictionaryKind(current.key)

  const openForm = (item: AnyDictionaryItem | null) => {
    actions.create.reset()
    actions.update.reset()
    setForm((state) => ({ open: true, item, session: state.session + 1 }))
  }

  const all = items.data ?? []
  const activeCount = all.filter((item) => !item.is_archived).length
  const archivedCount = all.length - activeCount
  const visible = all.filter(
    (item) =>
      (showArchive || !item.is_archived) &&
      (!query.trim() ||
        normalize(`${item.name} ${item.description ?? ''}`).includes(normalize(query.trim()))),
  )

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        crumbs={[
          { label: 'Главная', to: routes.home },
          { label: 'Кабинет', to: routes.cabinetRole('federation') },
          { label: 'Справочники', to: routes.dictionaries() },
          { label: current.title },
        ]}
        title={current.title}
        description={
          items.isSuccess
            ? `${activeCount} ${plural(activeCount, ['значение', 'значения', 'значений'])} в выборе${archivedCount ? ` · ${archivedCount} в архиве` : ''}`
            : undefined
        }
        // У простых справочников добавление — строкой над списком; кнопка нужна только справочникам с правилами
        actions={
          kind !== 'simple' && (
            <Button leftIcon={<IconPlus size={18} />} onClick={() => openForm(null)}>
              Добавить
            </Button>
          )
        }
      />

      <div className="grid gap-8 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <DictionaryNav
          catalog={catalog}
          current={current.key}
          onPick={(key) => navigate(routes.dictionaries(key))}
        />

        <div className="flex min-w-0 flex-col gap-5">
          {isDictionaryMock && (
            <FormAlert tone="info">
              Включён мок справочников (VITE_DICTIONARIES_API=mock): изменения сбросятся при перезагрузке.
            </FormAlert>
          )}

          {items.isSuccess && (
            <DictionaryVisual dictionaryKey={current.key} items={all} onSelect={(item) => openForm(item)} />
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex-1">
              <Input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Поиск по названию и описанию"
                aria-label="Поиск по справочнику"
                leftIcon={<IconSearch size={18} />}
                className="min-h-10"
              />
            </div>
            <Switch
              label={`Архив${archivedCount ? ` · ${archivedCount}` : ''}`}
              checked={showArchive}
              onChange={(event) => setShowArchive(event.target.checked)}
              className="shrink-0 sm:ml-2"
            />
          </div>

          {kind === 'simple' && (
            <QuickAdd actions={actions} placeholder={`Новое значение в «${current.title}»`} />
          )}

          {items.isPending ? (
            <RowsSkeleton />
          ) : items.isError ? (
            <ErrorState error={items.error} onRetry={() => items.refetch()} retrying={items.isFetching} />
          ) : visible.length === 0 ? (
            query.trim() ? (
              <EmptyState
                icon={<IconSearch size={26} />}
                title="Ничего не нашлось"
                description={`По запросу «${query.trim()}» в этом справочнике пусто`}
                action={
                  <Button variant="secondary" onClick={() => setQuery('')}>
                    Сбросить поиск
                  </Button>
                }
              />
            ) : (
              <EmptyState
                title="Пока пусто"
                description={
                  kind === 'simple' ? 'Введите первое значение в строке выше' : 'Добавьте первое значение'
                }
                action={
                  kind !== 'simple' && <Button onClick={() => openForm(null)}>Добавить значение</Button>
                }
              />
            )
          ) : (
            <ul className="divide-y divide-line-soft overflow-hidden rounded-lg border border-line-soft">
              {visible.map((item, index) => (
                <DictionaryRow
                  key={item.id}
                  item={item}
                  index={index}
                  onOpen={() => openForm(item)}
                  actions={<ItemActions item={item} actions={actions} onEdit={() => openForm(item)} />}
                />
              ))}
            </ul>
          )}
        </div>
      </div>

      <ItemFormDrawer
        key={form.session}
        open={form.open}
        item={form.item}
        dictionaryKey={current.key}
        dictionaryTitle={current.title}
        actions={actions}
        onClose={() => setForm((state) => ({ ...state, open: false }))}
      />
    </div>
  )
}

function DictionaryNav({
  catalog,
  current,
  onPick,
}: {
  catalog: DictionaryInfo[]
  current: DictionaryKey
  onPick: (key: DictionaryKey) => void
}) {
  return (
    <>
      <div className="lg:hidden">
        <Select
          aria-label="Справочник"
          value={current}
          onChange={(event) => onPick(event.target.value as DictionaryKey)}
          options={catalog.map((item) => ({ value: item.key, label: item.title }))}
        />
      </div>
      <nav aria-label="Справочники" className="sticky top-10 hidden flex-col gap-0.5 self-start lg:flex">
        {catalog.map((item) => (
          <NavLink
            key={item.key}
            to={routes.dictionaries(item.key)}
            className={({ isActive }) =>
              cn(
                'relative rounded-md px-3 py-2 text-body transition-colors duration-150',
                isActive ? 'bg-surface-3 text-ink' : 'text-muted hover:bg-hover-tint hover:text-ink',
              )
            }
          >
            {({ isActive }) => (
              <>
                <span
                  aria-hidden="true"
                  className={cn(
                    'absolute top-2 bottom-2 left-0 w-0.5 rounded-full bg-primary transition-[scale] duration-340 ease-emphasized',
                    isActive ? 'scale-y-100' : 'scale-y-0',
                  )}
                />
                {item.title}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </>
  )
}

function DictionaryRow({
  item,
  index,
  onOpen,
  actions,
}: {
  item: AnyDictionaryItem
  index: number
  onOpen: () => void
  actions: React.ReactNode
}) {
  const rules = describeRules(item)
  return (
    <li
      style={{ animationDelay: `${Math.min(index, 12) * 25}ms` }}
      className={cn(
        'group flex animate-rise items-center gap-3 pr-2 transition-colors duration-150 hover:bg-hover-tint',
        item.is_archived && 'opacity-60 hover:opacity-100',
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 flex-col gap-1 py-3.5 pl-4 text-left sm:pl-5"
      >
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span
            className={cn(
              'text-body',
              item.is_archived ? 'text-muted line-through decoration-line' : 'text-ink',
            )}
          >
            {item.name}
          </span>
          {item.is_archived && <StatusTag tone="done">В архиве</StatusTag>}
        </span>
        {item.description && <span className="text-sm text-muted">{item.description}</span>}
        {rules.length > 0 && (
          <span className="mt-1 flex flex-wrap gap-1.5">
            {item.rank_kind && <MetaTag className="font-mono">{item.rank_kind}</MetaTag>}
            {rules.map((rule) => (
              <MetaTag key={rule} accent className="font-mono">
                {rule}
              </MetaTag>
            ))}
          </span>
        )}
      </button>
      {actions}
    </li>
  )
}

function RowsSkeleton() {
  return (
    <div className="divide-y divide-line-soft rounded-lg border border-line-soft">
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="flex flex-col gap-2 px-5 py-4">
          <Skeleton className="h-4 w-2/5" />
          <Skeleton className="h-3 w-3/5" />
        </div>
      ))}
    </div>
  )
}

function DictionariesSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-10 w-72" />
      </div>
      <div className="grid gap-8 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <div className="hidden flex-col gap-2 lg:flex">
          {Array.from({ length: 8 }, (_, index) => (
            <Skeleton key={index} className="h-8" />
          ))}
        </div>
        <RowsSkeleton />
      </div>
    </div>
  )
}
