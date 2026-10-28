import { useState } from 'react'
import { Link } from 'react-router'
import { personAvatar } from '@/entities/person'
import { useMe } from '@/entities/session'
import type { Squad, SquadMember, SquadTarget } from '@/entities/squad'
import { SquadApproveModal, SquadDissolveModal } from '@/features/squad-manage'
import { routes } from '@/shared/config'
import { cn, formatDate, formatNumber } from '@/shared/lib'
import { Avatar, Button, IconButton, IconDots, Menu, TextLink } from '@/shared/ui'

function Member({ item, me }: { item: SquadMember; me?: string }) {
  return (
    <li
      className={cn('flex items-center gap-3 px-4 py-3 sm:px-5', item.athlete.id === me && 'bg-primary-soft')}
    >
      <span className="w-6 shrink-0 text-right font-mono text-sm text-muted tabular-nums">
        {item.position}
      </span>
      <Avatar name={item.athlete.name} src={personAvatar(item.athlete.id)} size="sm" />
      <span className="flex min-w-0 flex-1 flex-col">
        <Link
          to={routes.person(item.athlete.id)}
          className="truncate link-underline text-body text-ink focus-visible:field-focus"
        >
          {item.athlete.name}
        </Link>
        {item.municipality && <span className="truncate text-sm text-muted">{item.municipality.name}</span>}
      </span>
      <span className="shrink-0 font-mono text-sm text-muted tabular-nums">{formatNumber(item.points)}</span>
    </li>
  )
}

function Roster({ title, items, me }: { title: string; items: SquadMember[]; me?: string }) {
  return (
    <section className="flex min-w-0 flex-col">
      <h3 className="border-b border-line-soft px-4 pb-2 text-sm text-muted sm:px-5">{title}</h3>
      <ol className="divide-y divide-line-soft">
        {items.map((item) => (
          <Member key={item.athlete.id} item={item} me={me} />
        ))}
      </ol>
    </section>
  )
}

const targetOf = (squad: Squad): SquadTarget => ({
  discipline_id: squad.discipline.id,
  group_kind: squad.group_kind,
  group_id: squad.group.id,
})

/**
 * Карточка действующей сборной: группа, приказ, основной состав и резерв рядом.
 * Федерации — меню «⋯»: новый приказ или расформировать.
 */
export function SquadCard({ squad, className }: { squad: Squad; className?: string }) {
  const { data: me } = useMe()
  const canManage = Boolean(me?.available_roles.includes('federation'))
  const [approving, setApproving] = useState({ open: false, key: 0 })
  const [dissolving, setDissolving] = useState(false)

  return (
    <article id={`squad-${squad.group.id}`} className={cn('flex scroll-mt-24 flex-col card', className)}>
      <header className="flex items-start gap-4 p-4 sm:p-5">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h2 className="text-h3 font-medium">{squad.group.name}</h2>
          <p className="text-sm text-muted">
            Приказ{' '}
            <TextLink href={squad.order.url}>
              № {squad.order.number} от {formatDate(squad.order.date)}
            </TextLink>
          </p>
        </div>
        {canManage && (
          <Menu
            align="end"
            aria-label={`Действия: ${squad.title}`}
            items={[
              {
                id: 'renew',
                label: 'Новый приказ',
                onSelect: () => setApproving((state) => ({ open: true, key: state.key + 1 })),
              },
              { id: 'dissolve', label: 'Расформировать', onSelect: () => setDissolving(true) },
            ]}
            trigger={(props) => (
              <IconButton
                {...props}
                aria-label={`Действия: ${squad.title}`}
                data-no-tooltip
                icon={<IconDots size={18} />}
                size="sm"
              />
            )}
          />
        )}
      </header>
      <div className={cn('grid gap-4 pb-2', squad.reserve.length > 0 && 'lg:grid-cols-2')}>
        <Roster
          title={`Основной состав · ${squad.main.length} из ${squad.main_size}`}
          items={squad.main}
          me={me?.id}
        />
        {squad.reserve.length > 0 && (
          <Roster
            title={`Резерв · ${squad.reserve.length} из ${squad.reserve_size}`}
            items={squad.reserve}
            me={me?.id}
          />
        )}
      </div>
      {canManage && (
        <>
          <SquadApproveModal
            key={approving.key}
            open={approving.open}
            target={targetOf(squad)}
            title={`${squad.discipline.name} · ${squad.group.name}`}
            current={squad}
            onClose={() => setApproving((state) => ({ ...state, open: false }))}
          />
          <SquadDissolveModal open={dissolving} squad={squad} onClose={() => setDissolving(false)} />
        </>
      )}
    </article>
  )
}

/** Группа без сборной — строка у федерации с кнопкой «Утвердить» */
export function SquadMissing({
  target,
  title,
  group,
}: {
  target: SquadTarget
  title: string
  group: string
}) {
  const [approving, setApproving] = useState({ open: false, key: 0 })
  return (
    <li className="flex items-center justify-between gap-4 px-4 py-3 sm:px-5">
      <span className="truncate text-body text-ink">{group}</span>
      <Button
        size="sm"
        variant="secondary"
        onClick={() => setApproving((state) => ({ open: true, key: state.key + 1 }))}
      >
        Утвердить
      </Button>
      <SquadApproveModal
        key={approving.key}
        open={approving.open}
        target={target}
        title={title}
        current={null}
        onClose={() => setApproving((state) => ({ ...state, open: false }))}
      />
    </li>
  )
}
