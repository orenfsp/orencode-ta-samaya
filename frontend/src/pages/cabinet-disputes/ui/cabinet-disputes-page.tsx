import { useState } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { useAppealable, useDisputeQueue, useMyDisputes, type DisputeList } from '@/entities/dispute'
import { useMe } from '@/entities/session'
import { AppealModal, AppealsTable, ViolationsTable } from '@/features/dispute-manage'
import { routes } from '@/shared/config'
import { Button, ErrorState, IconPlus, PageHeader, Tabs } from '@/shared/ui'

function Lists({
  data,
  loading,
  federation,
  meId,
}: {
  data: DisputeList | undefined
  loading: boolean
  federation: boolean
  meId?: string
}) {
  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="text-h3 font-medium">Апелляции</h2>
        <AppealsTable
          items={data?.appeals ?? []}
          loading={loading}
          federation={federation}
          meId={meId}
          withContest
          empty={federation ? 'Апелляций на решение нет' : 'Вы не подавали апелляций'}
        />
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-h3 font-medium">Нарушения</h2>
        <ViolationsTable
          items={data?.violations ?? []}
          loading={loading}
          federation={federation}
          withContest
          empty={federation ? 'Рапортов на решение нет' : 'Решений по нарушениям нет'}
        />
      </section>
    </div>
  )
}

function Queue() {
  const [params, setParams] = useSearchParams()
  const all = params.get('view') === 'all'
  const queue = useDisputeQueue(all)
  return (
    <>
      <div className="w-full sm:w-auto sm:self-start">
        <Tabs
          aria-label="Что показать"
          fullWidth
          value={all ? 'all' : 'open'}
          onChange={(next) => setParams(next === 'all' ? { view: 'all' } : {}, { replace: true })}
          items={[
            { value: 'open', label: 'Ждут решения' },
            { value: 'all', label: 'Все' },
          ]}
        />
      </div>
      {queue.isError ? (
        <ErrorState error={queue.error} onRetry={() => void queue.refetch()} />
      ) : (
        <Lists data={queue.data} loading={queue.isPending} federation />
      )}
    </>
  )
}

function Mine() {
  const { data: me } = useMe()
  const mine = useMyDisputes()
  if (mine.isError) return <ErrorState error={mine.error} onRetry={() => void mine.refetch()} />
  return <Lists data={mine.data} loading={mine.isPending} federation={false} meId={me?.id} />
}

/** «Подать апелляцию»: соревнования, где срок открыт и места внесены — свои заявки и заявки подопечных */
function FileAppeal() {
  const appealable = useAppealable()
  const [modal, setModal] = useState({ open: false, key: 0 })
  const items = appealable.data ?? []
  return (
    <>
      <Button
        leftIcon={<IconPlus size={18} />}
        loading={appealable.isPending}
        disabled={!items.length}
        title={items.length ? undefined : 'Нет соревнований, где можно оспорить результат'}
        onClick={() => setModal((state) => ({ open: true, key: state.key + 1 }))}
      >
        Подать апелляцию
      </Button>
      <AppealModal
        key={modal.key}
        open={modal.open}
        choices={items}
        onClose={() => setModal((state) => ({ ...state, open: false }))}
      />
    </>
  )
}

/** Федерации — очередь апелляций и рапортов; спортсмену и тренеру — свои апелляции и решения по нарушениям */
export function CabinetDisputesPage() {
  const { role = 'athlete' } = useParams()
  const federation = role === 'federation'
  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        title={federation ? 'Апелляции и нарушения' : 'Мои апелляции'}
        description={
          federation
            ? 'Решения по апелляциям на места и по рапортам судей'
            : 'Апелляции по вашим заявкам и решения федерации по нарушениям'
        }
        crumbs={[
          { label: 'Главная', to: routes.home },
          { label: 'Кабинет', to: routes.cabinetRole(role) },
          { label: federation ? 'Апелляции и нарушения' : 'Мои апелляции' },
        ]}
        actions={federation ? undefined : <FileAppeal />}
      />
      {federation ? <Queue /> : <Mine />}
    </section>
  )
}
