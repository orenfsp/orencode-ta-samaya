import { useSearchParams } from 'react-router'
import { routes } from '@/shared/config'
import { Button, PageHeader, Tabs } from '@/shared/ui'
import { AthletesTab } from './athletes-tab'
import { HeadcountTab } from './headcount-tab'
import { CoachesTab, JudgesTab } from './staff-tabs'

type Tab = 'athletes' | 'coaches' | 'judges' | 'headcount'

const TABS: { value: Tab; label: string }[] = [
  { value: 'athletes', label: 'Спортсмены' },
  { value: 'coaches', label: 'Тренеры' },
  { value: 'judges', label: 'Судьи' },
  { value: 'headcount', label: 'Численность' },
]

/** Реестр федерации: спортсмены, тренеры, судьи с фильтрами и выгрузкой, численность занимающихся по годам */
export function CabinetRegistryPage() {
  const [params, setParams] = useSearchParams()
  const tab = (TABS.find((item) => item.value === params.get('tab'))?.value ?? 'athletes') as Tab

  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        title="Реестр"
        crumbs={[
          { label: 'Главная', to: routes.home },
          { label: 'Кабинет', to: routes.cabinetRole('federation') },
          { label: 'Реестр' },
        ]}
        actions={
          <Button variant="secondary" to={routes.cabinetOrganizations}>
            Организации
          </Button>
        }
      />
      <Tabs
        aria-label="Раздел реестра"
        variant="underline"
        value={tab}
        onChange={(next) => setParams(next === 'athletes' ? {} : { tab: next })}
        items={TABS}
      />
      {tab === 'athletes' ? (
        <AthletesTab />
      ) : tab === 'coaches' ? (
        <CoachesTab />
      ) : tab === 'judges' ? (
        <JudgesTab />
      ) : (
        <HeadcountTab />
      )}
    </section>
  )
}
