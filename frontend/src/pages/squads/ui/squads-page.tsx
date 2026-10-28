import { useEffect } from 'react'
import { useSearchParams } from 'react-router'
import { useDictionaryOptions } from '@/entities/dictionary'
import { DisciplineNav } from '@/entities/discipline'
import { groupKindTitles, useRatingBoards, type RatingGroupKind } from '@/entities/rating'
import { useMe } from '@/entities/session'
import { useSquads } from '@/entities/squad'
import { routes } from '@/shared/config'
import { EmptyState, ErrorState, PageHeader, SectionHeader, Skeleton, Tabs } from '@/shared/ui'
import { SquadCard, SquadMissing } from '@/widgets/squad-board'

/**
 * Сборные области: дисциплина и принцип групп, действующие сборные карточками.
 * Состав — верх рейтинга группы на дату приказа. Федерация утверждает сборные для групп, где их нет.
 */
export function SquadsPage() {
  const [params, setParams] = useSearchParams()
  const value = (key: string) => params.get(key) ?? ''
  const kind: RatingGroupKind = value('kind') === 'academic' ? 'academic' : 'age'
  const { data: me } = useMe()
  const canManage = Boolean(me?.available_roles.includes('federation'))
  const disciplines = useDictionaryOptions('disciplines')
  const disciplineId = value('discipline_id') || (disciplines.data?.[0] ? String(disciplines.data[0].id) : '')
  const squads = useSquads({ discipline_id: Number(disciplineId) || undefined, group_kind: kind })
  // Где можно утвердить сборную: группы, в рейтинге которых есть люди
  const boards = useRatingBoards({ discipline_id: disciplineId || undefined, group_kind: kind }, 1)
  const items = squads.data ?? []
  const withSquad = new Set(items.map((item) => item.group.id))
  const missing = (boards.data ?? []).filter((board) => board.total > 0 && !withSquad.has(board.group.id))
  const discipline = disciplines.data?.find((item) => String(item.id) === disciplineId)
  const focus = value('group_id')

  // Ссылка из уведомления или со страницы человека открывает нужную сборную
  useEffect(() => {
    if (focus && squads.data) document.getElementById(`squad-${focus}`)?.scrollIntoView({ block: 'start' })
  }, [focus, squads.data])

  const update = (changes: Record<string, string>) =>
    setParams(
      (current) => {
        const copy = new URLSearchParams(current)
        for (const [key, next] of Object.entries(changes)) {
          if (next) copy.set(key, next)
          else copy.delete(key)
        }
        copy.delete('group_id')
        return copy
      },
      { replace: true },
    )

  return (
    <div className="container-page flex flex-col gap-6 py-8 sm:py-12">
      <PageHeader
        crumbs={[{ label: 'Главная', to: routes.home }, { label: 'Сборные' }]}
        title="Сборные Оренбургской области"
        description="Состав — первые в рейтинге группы на дату приказа. Действует до нового приказа"
      />

      <div className="grid items-start gap-6 lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-10">
        {disciplines.data && disciplineId ? (
          <DisciplineNav
            className="lg:sticky lg:top-6"
            items={disciplines.data}
            value={disciplineId}
            onChange={(next) => update({ discipline_id: next })}
          />
        ) : (
          <Skeleton className="h-11 rounded-md lg:h-96" />
        )}
        <div className="flex min-w-0 flex-col gap-6">
          <div className="w-full sm:w-auto sm:self-start">
            <Tabs
              aria-label="Группы"
              fullWidth
              value={kind}
              onChange={(next) => update({ kind: next === 'academic' ? next : '' })}
              items={[
                { value: 'age', label: groupKindTitles.age },
                { value: 'academic', label: groupKindTitles.academic },
              ]}
            />
          </div>

          {squads.isPending || disciplines.isPending ? (
            <div className="flex flex-col gap-6">
              <Skeleton className="h-96 rounded-lg" />
              <Skeleton className="h-96 rounded-lg" />
            </div>
          ) : squads.isError ? (
            <ErrorState error={squads.error} onRetry={() => void squads.refetch()} />
          ) : (
            <>
              {items.length ? (
                <div className="flex flex-col gap-6" aria-busy={squads.isFetching}>
                  {items.map((squad) => (
                    <SquadCard
                      key={squad.id}
                      squad={squad}
                      className={
                        String(squad.group.id) === focus ? '[--c-card-border:var(--c-primary)]' : undefined
                      }
                    />
                  ))}
                </div>
              ) : (
                <div className="card">
                  <EmptyState
                    title="Сборных пока нет"
                    description={
                      canManage && missing.length
                        ? 'Утвердите сборную для группы ниже'
                        : 'Сборные утверждает федерация приказом'
                    }
                  />
                </div>
              )}

              {canManage && missing.length > 0 && discipline && (
                <section className="flex flex-col gap-3">
                  <SectionHeader
                    as="h3"
                    title="Без сборной"
                    description="Группы, в рейтинге которых есть спортсмены"
                  />
                  <ul className="divide-y divide-line-soft card">
                    {missing.map((board) => (
                      <SquadMissing
                        key={board.group.id}
                        group={board.group.name}
                        title={`${discipline.name} · ${board.group.name}`}
                        target={{ discipline_id: discipline.id, group_kind: kind, group_id: board.group.id }}
                      />
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
