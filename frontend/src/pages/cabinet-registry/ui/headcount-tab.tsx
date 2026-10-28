import { registryApi, useHeadcount, type HeadcountCut } from '@/entities/registry'
import {
  Button,
  ColumnChart,
  DeltaMark,
  ErrorState,
  Field,
  IconDownload,
  Select,
  Skeleton,
  StatTile,
  DataTable,
  SectionHeader,
  Toolbar,
} from '@/shared/ui'
import { useRegistryParams } from './use-params'

const CUTS: { value: HeadcountCut; label: string }[] = [
  { value: 'discipline', label: 'По дисциплинам' },
  { value: 'organization', label: 'По организациям' },
  { value: 'stage', label: 'По этапам подготовки' },
  { value: 'age_group', label: 'По возрастным группам' },
  { value: 'municipality', label: 'По муниципалитетам' },
]

const year = new Date().getFullYear()
const YEARS = Array.from({ length: 10 }, (_, index) => year - index)

const delta = (counts: number[]) => {
  const last = counts.at(-1) ?? 0
  const previous = counts.at(-2) ?? 0
  return {
    diff: last - previous,
    pct: previous ? Math.round(((last - previous) / previous) * 1000) / 10 : null,
  }
}

/** Отчёт «Численность занимающихся»: по годам, не меньше двух, в разрезах; xlsx — все разрезы листами */
export function HeadcountTab() {
  const { get, change } = useRegistryParams()
  const cut = (CUTS.find((item) => item.value === get('cut'))?.value ?? 'discipline') as HeadcountCut
  const to = Number(get('to')) || year
  const from = Math.min(Number(get('from')) || to - 2, to - 1)
  const report = useHeadcount(cut, from, to)
  const data = report.data
  const total = data ? delta(data.total) : null

  return (
    <div className="flex flex-col gap-6">
      <Toolbar
        end={
          <Button
            variant="secondary"
            leftIcon={<IconDownload size={18} />}
            href={registryApi.headcountXlsx(from, to)}
          >
            Выгрузить xlsx
          </Button>
        }
      >
        <Field label="С года">
          <Select
            value={String(from)}
            onChange={(event) => change('from', event.target.value)}
            options={YEARS.filter((value) => value < to).map((value) => ({
              value: String(value),
              label: String(value),
            }))}
          />
        </Field>
        <Field label="По год">
          <Select
            value={String(to)}
            onChange={(event) => change('to', event.target.value)}
            options={YEARS.map((value) => ({ value: String(value), label: String(value) }))}
          />
        </Field>
        <Field label="Разрез">
          <Select value={cut} onChange={(event) => change('cut', event.target.value)} options={CUTS} />
        </Field>
      </Toolbar>

      {report.isPending ? (
        <Skeleton className="h-72 rounded-lg" />
      ) : report.isError ? (
        <ErrorState error={report.error} onRetry={() => report.refetch()} />
      ) : (
        <>
          <SectionHeader title="Динамика численности" />
          <div className="grid gap-4 md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-1">
              <StatTile
                label={`Занимаются на ${report.data.years.at(-1) === year ? 'сегодня' : `конец ${report.data.years.at(-1)}`}`}
                value={report.data.total.at(-1) ?? 0}
                delta={total?.diff}
                deltaPct={total?.pct}
                hint={`к ${report.data.years.at(-2)} году`}
              />
              <StatTile
                label={`На конец ${report.data.years.at(-2)} года`}
                value={report.data.total.at(-2) ?? 0}
              />
            </div>
            <div className="card rounded-lg p-4">
              <ColumnChart
                data={report.data.years.map((value, index) => ({
                  label: String(value),
                  value: report.data.total[index] ?? 0,
                }))}
                unit="чел."
                height={160}
              />
            </div>
          </div>
          <SectionHeader title={CUTS.find((item) => item.value === cut)?.label ?? 'Численность'} />
          <DataTable
            caption="Численность занимающихся"
            rows={[
              { label: 'Всего занимающихся', counts: report.data.total },
              { label: 'из них в учебно-тренировочных группах', counts: report.data.in_groups },
              ...report.data.rows,
            ]}
            rowKey={(row) => row.label}
            columns={[
              { key: 'label', header: 'Показатель', primary: true, cell: (row) => row.label },
              ...report.data.years.map((value, index) => ({
                key: String(value),
                header: String(value),
                align: 'right' as const,
                cell: (row: { counts: number[] }) => (
                  <span className="font-mono tabular-nums">{row.counts[index] ?? 0}</span>
                ),
              })),
              {
                key: 'delta',
                header: 'За год',
                align: 'right',
                cell: (row) => {
                  const change = delta(row.counts)
                  return <DeltaMark diff={change.diff} pct={change.pct} compact />
                },
              },
            ]}
          />
          <p className="text-sm text-muted">
            Занимающийся — спортсмен с открытой дисциплиной в профиле или зачислением в группу на конец года.
            Текущий год — на сегодня. Источники: {report.data.sources.join('; ')}.
            {cut === 'discipline' && ' Спортсмен с двумя дисциплинами учтён в каждой.'}
          </p>
        </>
      )}
    </div>
  )
}
