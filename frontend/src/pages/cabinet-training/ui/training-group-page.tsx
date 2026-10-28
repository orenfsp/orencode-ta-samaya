import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useParams } from 'react-router'
import {
  trainingApi,
  trainingKeys,
  useAttestationBoard,
  useGroupSessions,
  useTrainingGroup,
  type BoardRow,
  type Enrollment,
  type TrainingSession,
} from '@/entities/training'
import {
  AttestationModal,
  EnrollModal,
  MoveModal,
  NormResultsModal,
  SessionFormModal,
} from '@/features/training-manage'
import { routes } from '@/shared/config'
import { formatDate } from '@/shared/lib'
import {
  Button,
  ConfirmModal,
  DataTable,
  EmptyState,
  ErrorState,
  Facts,
  IconButton,
  IconDots,
  IconPlus,
  IconTrash,
  Menu,
  MetaTag,
  Modal,
  PageHeader,
  SectionHeader,
  Skeleton,
  StatusTag,
  Tabs,
  TextLink,
  showToast,
  type Column,
} from '@/shared/ui'
import { NormHistory } from './norm-history'

type Tab = 'roster' | 'journal' | 'attestation'
const day = (value: string) => formatDate(`${value}T12:00:00Z`)

/** Группа: состав с историей зачислений, журнал занятий, нормативы и промежуточная аттестация */
export function TrainingGroupPage() {
  const { role = 'coach', groupId } = useParams()
  const id = Number(groupId)
  const group = useTrainingGroup(id)
  const [tab, setTab] = useState<Tab>('roster')
  const isFederation = role === 'federation'

  if (group.isPending) return <Skeleton className="h-96 rounded-lg" />
  if (group.isError) return <ErrorState error={group.error} onRetry={() => group.refetch()} />
  const { group: item, current, history } = group.data

  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        title={item.name}
        description={`${item.organization.name} · ${item.discipline.name} · ${item.stage.title}`}
        crumbs={[
          { label: 'Главная', to: routes.home },
          { label: 'Кабинет', to: routes.cabinetRole(role) },
          { label: 'Группы', to: routes.cabinetTraining(role) },
          { label: item.name },
        ]}
      />
      <Facts
        items={[
          { label: 'Тренер', value: item.coach.name },
          { label: 'Год набора', value: item.start_year },
          { label: 'Занимаются', value: `${current.length} чел.` },
          { label: 'Статус', value: item.is_active ? 'Действует' : 'Закрыта' },
        ]}
      />
      <Tabs
        variant="underline"
        value={tab}
        onChange={setTab}
        items={[
          { value: 'roster', label: 'Состав' },
          { value: 'journal', label: 'Журнал занятий' },
          { value: 'attestation', label: 'Нормативы и аттестация' },
        ]}
      />
      {tab === 'roster' && <Roster groupId={id} current={current} history={history} />}
      {tab === 'journal' && <Journal groupId={id} enrollments={[...current, ...history]} />}
      {tab === 'attestation' && <Attestation groupId={id} isFederation={isFederation} />}
    </section>
  )
}

function Roster({
  groupId,
  current,
  history,
}: {
  groupId: number
  current: Enrollment[]
  history: Enrollment[]
}) {
  const group = useTrainingGroup(groupId).data!.group
  const [enroll, setEnroll] = useState({ open: false, key: 0 })
  const [move, setMove] = useState<{
    open: boolean
    key: number
    mode: 'transfer' | 'expel'
    item: Enrollment | null
  }>({
    open: false,
    key: 0,
    mode: 'transfer',
    item: null,
  })
  const [details, setDetails] = useState<{ open: boolean; item: Enrollment | null }>({
    open: false,
    item: null,
  })
  const openMove = (mode: 'transfer' | 'expel', item: Enrollment) =>
    setMove((state) => ({ open: true, key: state.key + 1, mode, item }))

  const columns: Column<Enrollment>[] = [
    { key: 'athlete', header: 'Спортсмен', primary: true, cell: (row) => row.athlete.name },
    {
      key: 'since',
      header: 'В группе с',
      cell: (row) => <span className="font-mono text-sm tabular-nums">{day(row.valid_from)}</span>,
    },
    { key: 'order', header: 'Приказ', hideBelow: 'lg', cell: (row) => row.order_number ?? '—' },
    {
      key: 'actions',
      header: '',
      actions: true,
      align: 'right',
      cell: (row) => (
        <Menu
          align="end"
          aria-label={`Действия: ${row.athlete.name}`}
          items={[
            { id: 'transfer', label: 'Перевести', onSelect: () => openMove('transfer', row) },
            { id: 'expel', label: 'Отчислить', onSelect: () => openMove('expel', row) },
          ]}
          trigger={(props) => (
            <IconButton
              {...props}
              aria-label={`Действия: ${row.athlete.name}`}
              data-no-tooltip
              icon={<IconDots size={18} />}
              size="sm"
            />
          )}
        />
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader
        title="Сейчас занимаются"
        action={
          group.is_active && (
            <Button
              leftIcon={<IconPlus size={18} />}
              onClick={() => setEnroll((state) => ({ open: true, key: state.key + 1 }))}
            >
              Зачислить
            </Button>
          )
        }
      />
      <DataTable
        caption="Состав группы"
        columns={columns}
        rows={current}
        rowKey={(row) => row.id}
        onRowClick={(row) => setDetails({ open: true, item: row })}
        empty={<EmptyState title="В группе никого нет" description="Зачислите спортсменов приказом" />}
      />
      {history.length > 0 && (
        <section className="flex flex-col gap-3">
          <SectionHeader title="Выбыли" as="h3" />
          <ul className="flex flex-col divide-y divide-line-soft rounded-lg border border-line-soft">
            {history.map((row) => (
              <li key={row.id} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2.5">
                <span className="flex min-w-0 flex-col">
                  <span className="text-ink">{row.athlete.name}</span>
                  <span className="text-sm text-muted">
                    {[row.end_reason_title, row.order_number && `приказ ${row.order_number}`, row.note]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
                <span className="font-mono text-sm text-muted tabular-nums">
                  {day(row.valid_from)} – {row.valid_to && day(row.valid_to)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <EnrollModal
        key={enroll.key}
        open={enroll.open}
        group={group}
        onClose={() => setEnroll((state) => ({ ...state, open: false }))}
      />
      <MoveModal
        key={move.key}
        open={move.open}
        mode={move.mode}
        enrollment={move.item}
        onClose={() => setMove((state) => ({ ...state, open: false }))}
      />
      <Modal
        open={details.open}
        onClose={() => setDetails((state) => ({ ...state, open: false }))}
        size="xl"
        title={details.item?.athlete.name ?? 'Спортсмен'}
        description="Нормативы и аттестации"
      >
        {details.item && <NormHistory athleteId={details.item.athlete.id} />}
      </Modal>
    </div>
  )
}

function Journal({ groupId, enrollments }: { groupId: number; enrollments: Enrollment[] }) {
  const client = useQueryClient()
  const sessions = useGroupSessions(groupId)
  const [form, setForm] = useState<{ open: boolean; key: number; item: TrainingSession | null }>({
    open: false,
    key: 0,
    item: null,
  })
  const [removing, setRemoving] = useState<{ open: boolean; item: TrainingSession | null }>({
    open: false,
    item: null,
  })
  const remove = useMutation({
    mutationFn: (id: string) => trainingApi.removeSession(id),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: trainingKeys.all })
      showToast('Занятие удалено', { tone: 'success' })
    },
  })
  const open = (item: TrainingSession | null) =>
    setForm((state) => ({ open: true, key: state.key + 1, item }))

  const columns: Column<TrainingSession>[] = [
    {
      key: 'date',
      header: 'Дата',
      cell: (row) => <span className="font-mono text-sm tabular-nums">{day(row.held_on)}</span>,
    },
    { key: 'topic', header: 'Тема', primary: true, cell: (row) => row.topic },
    {
      key: 'format',
      header: 'Формат',
      cell: (row) => <MetaTag accent={row.format === 'online'}>{row.format_title}</MetaTag>,
    },
    {
      key: 'proof',
      header: 'Подтверждение',
      hideBelow: 'lg',
      cell: (row) => (row.proof_url ? <TextLink href={row.proof_url}>Запись</TextLink> : '—'),
    },
    {
      key: 'present',
      header: 'Были',
      align: 'right',
      cell: (row) => (
        <span className="font-mono tabular-nums">
          {row.present} из {row.marks.length}
        </span>
      ),
    },
    {
      key: 'remove',
      header: '',
      actions: true,
      align: 'right',
      cell: (row) => (
        <IconButton
          aria-label="Удалить занятие"
          icon={<IconTrash size={18} />}
          size="sm"
          onClick={() => setRemoving({ open: true, item: row })}
        />
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <SectionHeader
        title="Журнал"
        description="Онлайн-занятие подтверждается ссылкой на запись или лог платформы"
        action={
          <Button leftIcon={<IconPlus size={18} />} onClick={() => open(null)}>
            Записать занятие
          </Button>
        }
      />
      {sessions.isError ? (
        <ErrorState error={sessions.error} onRetry={() => sessions.refetch()} />
      ) : (
        <DataTable
          caption="Журнал занятий"
          columns={columns}
          rows={sessions.data?.sessions ?? []}
          rowKey={(row) => row.id}
          loading={sessions.isPending}
          onRowClick={open}
          empty={
            <EmptyState
              title="Занятий ещё нет"
              description="Записывайте каждое занятие с темой и отметками"
              action={<Button onClick={() => open(null)}>Записать занятие</Button>}
            />
          }
        />
      )}
      <SessionFormModal
        key={form.key}
        open={form.open}
        groupId={groupId}
        enrollments={enrollments}
        item={form.item}
        onClose={() => setForm((state) => ({ ...state, open: false }))}
      />
      <ConfirmModal
        open={removing.open}
        onClose={() => setRemoving((state) => ({ ...state, open: false }))}
        onConfirm={async () => {
          if (removing.item) await remove.mutateAsync(removing.item.id)
          setRemoving((state) => ({ ...state, open: false }))
        }}
        title="Удалить занятие?"
        description={removing.item ? `${day(removing.item.held_on)} · ${removing.item.topic}` : undefined}
        confirmLabel="Удалить"
        tone="danger"
      />
    </div>
  )
}

function Attestation({ groupId, isFederation }: { groupId: number; isFederation: boolean }) {
  const board = useAttestationBoard(groupId)
  const [results, setResults] = useState({ open: false, key: 0 })
  const [decision, setDecision] = useState<{ open: boolean; key: number; row: BoardRow | null }>({
    open: false,
    key: 0,
    row: null,
  })

  if (board.isPending) return <Skeleton className="h-64 rounded-lg" />
  if (board.isError) return <ErrorState error={board.error} onRetry={() => board.refetch()} />
  const data = board.data
  const ready = data.rows.filter((row) => row.ready).length

  const columns: Column<BoardRow>[] = [
    { key: 'athlete', header: 'Спортсмен', primary: true, cell: (row) => row.athlete.name },
    {
      key: 'passed',
      header: 'Выполнено',
      align: 'right',
      cell: (row) => (
        <span className="font-mono tabular-nums">
          {row.passed} из {row.required}
        </span>
      ),
    },
    {
      key: 'state',
      header: 'Готовность',
      cell: (row) => (
        <StatusTag tone={row.ready ? 'active' : 'draft'}>
          {row.ready ? 'Готов к переводу' : 'Не готов'}
        </StatusTag>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <SectionHeader
        title={
          data.target_stage
            ? `Перевод на этап «${data.target_stage.title}»`
            : 'Этап высшего мастерства — последний'
        }
        description={
          data.target_stage
            ? `Готовы ${ready} из ${data.rows.length}. Учитываются результаты за последний год по приказу Минспорта № 445`
            : 'Перевода дальше нет. Нормативы этапа можно принимать для контроля'
        }
        action={
          <Button
            variant="secondary"
            onClick={() => setResults((state) => ({ open: true, key: state.key + 1 }))}
          >
            Принять нормативы
          </Button>
        }
      />
      <DataTable
        caption="Аттестационная ведомость"
        columns={columns}
        rows={data.rows}
        rowKey={(row) => row.enrollment_id}
        onRowClick={(row) => setDecision((state) => ({ open: true, key: state.key + 1, row }))}
        empty={
          <EmptyState
            title="В группе никого нет"
            description="Ведомость появится, когда в группе будут спортсмены"
          />
        }
      />
      {data.history.length > 0 && (
        <section className="flex flex-col gap-3">
          <SectionHeader title="Решения" as="h3" />
          <ul className="flex flex-col divide-y divide-line-soft rounded-lg border border-line-soft">
            {data.history.map((item) => (
              <li key={item.id} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2.5">
                <span className="flex min-w-0 flex-col">
                  <span className="text-ink">{item.athlete.name}</span>
                  <span className="text-sm text-muted">
                    {item.result_title}
                    {item.target_group && ` → ${item.target_group.name}`}
                  </span>
                  {item.comment && <span className="text-sm text-muted">{item.comment}</span>}
                </span>
                <span className="font-mono text-sm text-muted tabular-nums">{day(item.decided_on)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <NormResultsModal
        key={results.key}
        open={results.open}
        group={data.group}
        athletes={data.rows.map((row) => row.athlete)}
        onClose={() => setResults((state) => ({ ...state, open: false }))}
      />
      <AttestationModal
        key={decision.key}
        open={decision.open}
        board={data}
        row={decision.row}
        isFederation={isFederation}
        onClose={() => setDecision((state) => ({ ...state, open: false }))}
      />
    </div>
  )
}
