import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { useDictionaryOptions } from '@/entities/dictionary'
import { stageOptions, useTrainingGroups, type TrainingGroup, type TrainingStage } from '@/entities/training'
import { GroupFormModal } from '@/features/training-manage'
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
import { AthleteTraining } from './athlete-training'

const columns: Column<TrainingGroup>[] = [
  {
    key: 'name',
    header: 'Группа',
    primary: true,
    cell: (item) => (
      <span className="flex min-w-0 flex-col">
        <span className="text-ink">{item.name}</span>
        <span className="truncate text-xs text-muted">{item.organization.name}</span>
      </span>
    ),
  },
  { key: 'stage', header: 'Этап', cell: (item) => item.stage.title },
  { key: 'discipline', header: 'Дисциплина', hideBelow: 'lg', cell: (item) => item.discipline.name },
  { key: 'coach', header: 'Тренер', hideBelow: 'xl', cell: (item) => item.coach.name },
  {
    key: 'size',
    header: 'Спортсменов',
    align: 'right',
    cell: (item) => <span className="font-mono tabular-nums">{item.size}</span>,
  },
  {
    key: 'status',
    header: 'Статус',
    hideBelow: 'xl',
    cell: (item) => (
      <StatusTag tone={item.is_active ? 'active' : 'done'}>
        {item.is_active ? 'Занимается' : 'Закрыта'}
      </StatusTag>
    ),
  },
]

/** Учебно-тренировочные группы: тренер видит свои, федерация — все. У спортсмена — своя группа и нормативы */
export function CabinetTrainingPage() {
  const { role = 'coach' } = useParams()
  if (role === 'athlete') return <AthleteTraining />
  return <GroupList role={role} />
}

function GroupList({ role }: { role: string }) {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const stage = (params.get('stage') ?? '') as TrainingStage | ''
  const discipline = params.get('discipline') ?? ''
  const closed = params.get('closed') === '1'
  const disciplines = useDictionaryOptions('disciplines')
  const groups = useTrainingGroups({
    stage: stage || undefined,
    discipline_id: discipline ? Number(discipline) : undefined,
    active_only: !closed,
  })
  const [form, setForm] = useState({ open: false, key: 0 })
  const isFederation = role === 'federation'
  const filtered = Boolean(stage || discipline || closed)

  const change = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }
  const create = () => setForm((state) => ({ open: true, key: state.key + 1 }))

  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        title="Группы"
        description="Зачисление и перевод, журнал занятий, нормативы и аттестация"
        crumbs={[
          { label: 'Главная', to: routes.home },
          { label: 'Кабинет', to: routes.cabinetRole(role) },
          { label: 'Группы' },
        ]}
        actions={
          <Button leftIcon={<IconPlus size={18} />} onClick={create}>
            Новая группа
          </Button>
        }
      />
      <Toolbar
        end={
          filtered && (
            <Button variant="ghost" onClick={() => setParams({})}>
              Сбросить
            </Button>
          )
        }
      >
        <Field label="Этап">
          <Select
            value={stage}
            onChange={(event) => change('stage', event.target.value)}
            options={[
              { value: '', label: 'Все этапы' },
              ...stageOptions.map((item) => ({ value: item.value, label: item.label })),
            ]}
          />
        </Field>
        <Field label="Дисциплина">
          <Select
            value={discipline}
            onChange={(event) => change('discipline', event.target.value)}
            options={[
              { value: '', label: 'Все' },
              ...(disciplines.data ?? []).map((item) => ({ value: String(item.id), label: item.name })),
            ]}
          />
        </Field>
        <Field label="Показать">
          <Select
            value={closed ? '1' : ''}
            onChange={(event) => change('closed', event.target.value)}
            options={[
              { value: '', label: 'Действующие' },
              { value: '1', label: 'С закрытыми' },
            ]}
          />
        </Field>
      </Toolbar>
      {groups.isError ? (
        <ErrorState error={groups.error} onRetry={() => groups.refetch()} />
      ) : (
        <DataTable
          caption="Группы"
          columns={columns}
          rows={groups.data ?? []}
          rowKey={(item) => item.id}
          loading={groups.isPending}
          onRowClick={(item) => navigate(routes.cabinetTrainingGroup(role, item.id))}
          empty={
            <EmptyState
              title={filtered ? 'Таких групп нет' : 'Групп пока нет'}
              description={
                filtered
                  ? 'Измените фильтры'
                  : isFederation
                    ? 'Группы открываются по программам подготовки организаций'
                    : 'Откройте группу по программе своей организации'
              }
              action={<Button onClick={create}>Новая группа</Button>}
            />
          }
        />
      )}
      <GroupFormModal
        key={form.key}
        open={form.open}
        isFederation={isFederation}
        onClose={() => setForm((state) => ({ ...state, open: false }))}
      />
    </section>
  )
}
