import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { disputeApi, disputeKeys, type Appeal, type DisputeFile, type Violation } from '@/entities/dispute'
import { routes } from '@/shared/config'
import { formatDate } from '@/shared/lib'
import {
  Button,
  ConfirmModal,
  DataTable,
  EmptyState,
  Facts,
  Modal,
  StatusTag,
  TextLink,
  type Column,
} from '@/shared/ui'
import { appealTone, violationTone } from '../lib/tones'
import { DecideAppealModal } from './decide-appeal-modal'
import { DecideViolationModal } from './decide-violation-modal'

function Evidence({ url, files }: { url: string | null; files: DisputeFile[] }) {
  if (!url && !files.length) return <span className="text-muted">Нет</span>
  return (
    <span className="flex flex-col gap-1">
      {files.map((file) => (
        <TextLink key={file.id} href={file.url}>
          {file.name}
        </TextLink>
      ))}
      {url && <TextLink href={url}>Ссылка на видео или облако</TextLink>}
    </span>
  )
}

const place = (value: number | null) => (value ? `${value}` : '—')

const appealColumns = (withContest: boolean): Column<Appeal>[] => [
  {
    key: 'entry',
    header: withContest ? 'Соревнование и заявка' : 'Заявка',
    primary: true,
    cell: (item) => (
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-ink">{withContest ? item.contest.title : item.entry}</span>
        {withContest && <span className="truncate text-sm text-muted">{item.entry}</span>}
      </span>
    ),
  },
  {
    key: 'place',
    header: 'Место → просит',
    width: 'w-36',
    cell: (item) => (
      <span className="font-mono tabular-nums">
        {place(item.current_place)} → {place(item.requested_place)}
      </span>
    ),
  },
  {
    key: 'status',
    header: 'Статус',
    width: 'w-44',
    cell: (item) => <StatusTag tone={appealTone[item.status]}>{item.status_title}</StatusTag>,
  },
  {
    key: 'created',
    header: 'Подана',
    width: 'w-28',
    hideBelow: 'lg',
    cell: (item) => (
      <span className="font-mono text-sm text-muted tabular-nums">{formatDate(item.created_at)}</span>
    ),
  },
]

const violationColumns = (withContest: boolean): Column<Violation>[] => [
  {
    key: 'athlete',
    header: 'Участник',
    primary: true,
    cell: (item) => (
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-ink">{item.athlete.name}</span>
        {withContest && <span className="truncate text-sm text-muted">{item.contest.title}</span>}
      </span>
    ),
  },
  {
    key: 'sanction',
    header: 'Решение',
    cell: (item) =>
      item.sanction_title ? (
        <span className="text-ink">
          {item.sanction_title}
          {item.suspended_until && ` до ${formatDate(item.suspended_until)}`}
        </span>
      ) : (
        <span className="text-muted">—</span>
      ),
  },
  {
    key: 'status',
    header: 'Статус',
    width: 'w-44',
    cell: (item) => <StatusTag tone={violationTone[item.status]}>{item.status_title}</StatusTag>,
  },
  {
    key: 'created',
    header: 'Рапорт',
    width: 'w-28',
    hideBelow: 'lg',
    cell: (item) => (
      <span className="font-mono text-sm text-muted tabular-nums">{formatDate(item.created_at)}</span>
    ),
  },
]

/**
 * Апелляции таблицей, детали — в окне. Федерация берёт на рассмотрение и решает,
 * подавший отзывает, пока решения нет.
 */
export function AppealsTable({
  items,
  federation,
  meId,
  withContest = false,
  loading,
  empty,
}: {
  items: Appeal[]
  federation: boolean
  meId?: string
  withContest?: boolean
  loading?: boolean
  empty: string
}) {
  const client = useQueryClient()
  const [shown, setShown] = useState<Appeal | null>(null)
  const [detail, setDetail] = useState(false)
  const [decide, setDecide] = useState({ open: false, key: 0 })
  const [withdraw, setWithdraw] = useState(false)
  const done = () => void client.invalidateQueries({ queryKey: disputeKeys.all })
  const review = useMutation({
    mutationFn: (id: string) => disputeApi.review(id),
    onSuccess: (item) => {
      done()
      setShown(item)
    },
  })
  const recall = useMutation({
    mutationFn: (id: string) => disputeApi.withdraw(id),
    onSuccess: () => {
      done()
      setDetail(false)
    },
  })
  const open = shown && (shown.status === 'submitted' || shown.status === 'reviewing')

  return (
    <>
      <DataTable
        caption="Апелляции"
        columns={appealColumns(withContest)}
        rows={items}
        rowKey={(item) => item.id}
        loading={loading}
        onRowClick={(item) => {
          setShown(item)
          setDetail(true)
        }}
        empty={<EmptyState title={empty} />}
      />
      <Modal
        open={detail}
        onClose={() => setDetail(false)}
        size="md"
        title="Апелляция"
        description={shown ? `${shown.contest.title} · ${shown.entry}` : undefined}
        footer={
          shown && (
            <>
              <Button variant="ghost" onClick={() => setDetail(false)}>
                Закрыть
              </Button>
              {open && shown.filer.id === meId && (
                <Button variant="secondary" onClick={() => setWithdraw(true)}>
                  Отозвать
                </Button>
              )}
              {federation && shown.status === 'submitted' && (
                <Button
                  variant="secondary"
                  loading={review.isPending}
                  onClick={() => review.mutate(shown.id)}
                >
                  Взять на рассмотрение
                </Button>
              )}
              {federation && open && (
                <Button
                  onClick={() => {
                    setDetail(false)
                    setDecide((state) => ({ open: true, key: state.key + 1 }))
                  }}
                >
                  Решить
                </Button>
              )}
            </>
          )
        }
      >
        {shown && (
          <div className="flex flex-col gap-5">
            <Facts
              items={[
                {
                  label: 'Статус',
                  value: <StatusTag tone={appealTone[shown.status]}>{shown.status_title}</StatusTag>,
                },
                { label: 'Подал', value: shown.filer.name },
                { label: 'Место в протоколе', value: place(shown.current_place) },
                { label: 'Просит', value: place(shown.requested_place) },
                { label: 'Подана', value: formatDate(shown.created_at) },
                { label: 'Доказательства', value: <Evidence url={shown.evidence_url} files={shown.files} /> },
                shown.decision ? { label: 'Решение', value: shown.decision } : null,
              ]}
            />
            <p className="text-body whitespace-pre-line text-ink">{shown.reason}</p>
            <TextLink to={routes.competition(shown.contest.id)}>Страница соревнования</TextLink>
          </div>
        )}
      </Modal>
      {shown && federation && (
        <DecideAppealModal
          key={decide.key}
          open={decide.open}
          appeal={shown}
          onClose={() => setDecide((state) => ({ ...state, open: false }))}
        />
      )}
      <ConfirmModal
        open={withdraw}
        title="Отозвать апелляцию?"
        description="Подать новую по этой заявке можно, пока не истёк срок"
        confirmLabel="Отозвать"
        tone="danger"
        onClose={() => setWithdraw(false)}
        onConfirm={async () => {
          if (shown) await recall.mutateAsync(shown.id)
        }}
      />
    </>
  )
}

/** Рапорты о нарушениях таблицей, детали — в окне; федерация принимает решение */
export function ViolationsTable({
  items,
  federation,
  withContest = false,
  loading,
  empty,
}: {
  items: Violation[]
  federation: boolean
  withContest?: boolean
  loading?: boolean
  empty: string
}) {
  const [shown, setShown] = useState<Violation | null>(null)
  const [detail, setDetail] = useState(false)
  const [decide, setDecide] = useState({ open: false, key: 0 })

  return (
    <>
      <DataTable
        caption="Нарушения"
        columns={violationColumns(withContest)}
        rows={items}
        rowKey={(item) => item.id}
        loading={loading}
        onRowClick={(item) => {
          setShown(item)
          setDetail(true)
        }}
        empty={<EmptyState title={empty} />}
      />
      <Modal
        open={detail}
        onClose={() => setDetail(false)}
        size="md"
        title="Нарушение"
        description={shown ? `${shown.athlete.name} · ${shown.contest.title}` : undefined}
        footer={
          shown && (
            <>
              <Button variant="ghost" onClick={() => setDetail(false)}>
                Закрыть
              </Button>
              {federation && shown.status === 'reported' && (
                <Button
                  onClick={() => {
                    setDetail(false)
                    setDecide((state) => ({ open: true, key: state.key + 1 }))
                  }}
                >
                  Решить
                </Button>
              )}
            </>
          )
        }
      >
        {shown && (
          <div className="flex flex-col gap-5">
            <Facts
              items={[
                {
                  label: 'Статус',
                  value: <StatusTag tone={violationTone[shown.status]}>{shown.status_title}</StatusTag>,
                },
                shown.reporter ? { label: 'Рапорт', value: shown.reporter.name } : null,
                shown.sanction_title ? { label: 'Санкция', value: shown.sanction_title } : null,
                shown.suspended_until
                  ? { label: 'Отстранён до', value: formatDate(shown.suspended_until) }
                  : null,
                shown.reporter
                  ? {
                      label: 'Доказательства',
                      value: <Evidence url={shown.evidence_url} files={shown.files} />,
                    }
                  : null,
                shown.decision ? { label: 'Решение', value: shown.decision } : null,
              ]}
            />
            <p className="text-body whitespace-pre-line text-ink">{shown.description}</p>
          </div>
        )}
      </Modal>
      {shown && federation && (
        <DecideViolationModal
          key={decide.key}
          open={decide.open}
          violation={shown}
          onClose={() => setDecide((state) => ({ ...state, open: false }))}
        />
      )}
    </>
  )
}
