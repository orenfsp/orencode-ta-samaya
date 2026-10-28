import { useState } from 'react'
import { Link } from 'react-router'
import { useCoachLinks, linkTone, type CoachLink, type CoachLinkStatus } from '@/entities/sport-profile'
import { LinkDetailsModal, LinkRequestModal } from '@/features/coach-links'
import { routes } from '@/shared/config'
import { formatDate } from '@/shared/lib'
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

const STATUSES: { value: '' | CoachLinkStatus; label: string }[] = [
  { value: '', label: 'Все, кроме завершённых' },
  { value: 'active', label: 'Активные' },
  { value: 'requested', label: 'Ждут подтверждения' },
  { value: 'suspended', label: 'Приостановленные' },
  { value: 'ended', label: 'Завершённые' },
  { value: 'declined', label: 'Отклонённые' },
]

const columns: Column<CoachLink>[] = [
  {
    key: 'athlete',
    header: 'Спортсмен',
    primary: true,
    cell: (link) => (
      <Link
        to={routes.person(link.athlete.id)}
        className="link-underline text-ink"
        onClick={(event) => event.stopPropagation()}
      >
        {link.athlete.name}
      </Link>
    ),
  },
  { key: 'discipline', header: 'Дисциплина', cell: (link) => link.discipline.name },
  {
    key: 'status',
    header: 'Статус',
    cell: (link) => <StatusTag tone={linkTone[link.status]}>{link.status_title}</StatusTag>,
  },
  {
    key: 'since',
    header: 'Изменено',
    hideBelow: 'lg',
    cell: (link) => (
      <span className="font-mono text-sm text-muted tabular-nums">{formatDate(link.updated_at)}</span>
    ),
  },
]

/** Подопечные тренера по связям: запрос с дисциплиной, подтверждение спортсменом, статусы и история */
export function CabinetCoachAthletesPage() {
  const links = useCoachLinks()
  const [status, setStatus] = useState<'' | CoachLinkStatus>('')
  const [request, setRequest] = useState({ open: false, key: 0 })
  const [opened, setOpened] = useState<{ open: boolean; link: CoachLink | null }>({ open: false, link: null })
  const all = links.data?.as_coach ?? []
  const rows = all.filter((link) =>
    status ? link.status === status : link.status !== 'ended' && link.status !== 'declined',
  )
  const ask = () => setRequest((state) => ({ open: true, key: state.key + 1 }))

  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        title="Мои спортсмены"
        description="За привязанных спортсменов вы подаёте заявки и разряды и видите их отчёты"
        crumbs={[
          { label: 'Главная', to: routes.home },
          { label: 'Кабинет', to: routes.cabinetRole('coach') },
          { label: 'Мои спортсмены' },
        ]}
        actions={
          <Button leftIcon={<IconPlus size={18} />} onClick={ask}>
            Привязать спортсмена
          </Button>
        }
      />
      <Toolbar>
        <Field label="Статус">
          <Select
            value={status}
            onChange={(event) => setStatus(event.target.value as '' | CoachLinkStatus)}
            options={STATUSES}
          />
        </Field>
      </Toolbar>
      {links.isError ? (
        <ErrorState error={links.error} onRetry={() => links.refetch()} />
      ) : (
        <DataTable
          caption="Мои спортсмены"
          columns={columns}
          rows={rows}
          rowKey={(link) => link.id}
          loading={links.isPending}
          onRowClick={(link) => setOpened({ open: true, link })}
          empty={
            <EmptyState
              title={all.length ? 'Таких связей нет' : 'Спортсменов пока нет'}
              description="Найдите спортсмена в реестре и отправьте запрос с дисциплиной"
              action={<Button onClick={ask}>Привязать спортсмена</Button>}
            />
          }
        />
      )}
      <LinkRequestModal
        key={request.key}
        open={request.open}
        onClose={() => setRequest((state) => ({ ...state, open: false }))}
      />
      <LinkDetailsModal
        open={opened.open}
        link={opened.link}
        asAthlete={false}
        onClose={() => setOpened((state) => ({ ...state, open: false }))}
      />
    </section>
  )
}
