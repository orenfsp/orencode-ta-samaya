import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { formatNormValue, stageOptions, useNorms, type Norm, type TrainingStage } from '@/entities/training'
import { NormFormModal } from '@/features/training-manage'
import { routes } from '@/shared/config'
import {
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  Field,
  IconPlus,
  PageHeader,
  Select,
  StatusTag,
  Toolbar,
  type Column,
} from '@/shared/ui'

const columns: Column<Norm>[] = [
  {
    key: 'name',
    header: 'Упражнение',
    primary: true,
    cell: (item) => (
      <span className="flex min-w-0 flex-col">
        <span className="text-ink">{item.name}</span>
        <span className="text-xs text-muted">
          {item.kind === 'sfp' ? 'СФП' : 'ОФП'} ·{' '}
          {item.disciplines.length
            ? item.disciplines.map((value) => value.name).join(', ')
            : 'все дисциплины'}
        </span>
      </span>
    ),
  },
  { key: 'stage', header: 'Этап', hideBelow: 'lg', cell: (item) => item.stage.title },
  {
    key: 'male',
    header: 'Юноши',
    align: 'right',
    cell: (item) => (
      <span className="font-mono tabular-nums">
        {item.threshold_male === null
          ? '—'
          : `${item.direction === 'higher' ? '≥' : '≤'} ${formatNormValue(item.threshold_male, item.unit)}`}
      </span>
    ),
  },
  {
    key: 'female',
    header: 'Девушки',
    align: 'right',
    cell: (item) => (
      <span className="font-mono tabular-nums">
        {item.threshold_female === null
          ? '—'
          : `${item.direction === 'higher' ? '≥' : '≤'} ${formatNormValue(item.threshold_female, item.unit)}`}
      </span>
    ),
  },
  { key: 'unit', header: 'Ед.', hideBelow: 'lg', cell: (item) => item.unit_title },
  {
    key: 'source',
    header: 'Источник',
    hideBelow: 'xl',
    cell: (item) =>
      item.is_archived ? (
        <StatusTag tone="done">В архиве</StatusTag>
      ) : item.is_demo ? (
        <StatusTag tone="draft">Демо</StatusTag>
      ) : (
        <span className="text-sm text-muted">{item.source}</span>
      ),
  },
]

/** Справочник нормативов ФССП: пороги по этапу, дисциплине и полу. Федерация пополняет и правит */
export function NormsPage() {
  const [params, setParams] = useSearchParams()
  const stage = (params.get('stage') ?? 'initial') as TrainingStage
  const norms = useNorms(true, stage)
  const [form, setForm] = useState<{ open: boolean; key: number; item: Norm | null }>({
    open: false,
    key: 0,
    item: null,
  })
  const open = (item: Norm | null) => setForm((state) => ({ open: true, key: state.key + 1, item }))

  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        title="Нормативы"
        description="Федеральный стандарт спортивной подготовки, приказ Минспорта России от 24.06.2025 № 445"
        crumbs={[
          { label: 'Главная', to: routes.home },
          { label: 'Кабинет', to: routes.cabinetRole('federation') },
          { label: 'Нормативы' },
        ]}
        actions={
          <Button leftIcon={<IconPlus size={18} />} onClick={() => open(null)}>
            Добавить
          </Button>
        }
      />
      <Toolbar>
        <Field label="Для зачисления на этап">
          <Select
            value={stage}
            onChange={(event) => setParams({ stage: event.target.value }, { replace: true })}
            options={stageOptions.map((item) => ({ value: item.value, label: item.label }))}
          />
        </Field>
      </Toolbar>
      {norms.isError ? (
        <ErrorState error={norms.error} onRetry={() => norms.refetch()} />
      ) : (
        <DataTable
          caption="Нормативы"
          columns={columns}
          rows={norms.data ?? []}
          rowKey={(item) => item.id}
          loading={norms.isPending}
          onRowClick={open}
          empty={
            <EmptyState
              title="Нормативов этапа нет"
              description="Добавьте упражнения и пороги из федерального стандарта"
              action={<Button onClick={() => open(null)}>Добавить норматив</Button>}
            />
          }
        />
      )}
      <NormFormModal
        key={form.key}
        open={form.open}
        item={form.item}
        onClose={() => setForm((state) => ({ ...state, open: false }))}
      />
    </section>
  )
}
