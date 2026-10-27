import type { RatingPoint } from '@/entities/competition'
import { Button, IconButton, IconMinus, IconPlus, Input } from '@/shared/ui'

/** Таблица «место → баллы»: места идут подряд с 1, добавляются и убираются с конца */
export function RatingPointsEditor({
  value,
  onChange,
  error,
}: {
  value: RatingPoint[]
  onChange: (points: RatingPoint[]) => void
  error?: string
}) {
  const setPoints = (place: number, points: string) =>
    onChange(
      value.map((row) => (row.place === place ? { ...row, points: Math.max(0, Number(points) || 0) } : row)),
    )

  return (
    <div className="flex flex-col gap-3">
      <ul className="divide-y divide-line-soft overflow-hidden rounded-lg border border-line-soft">
        {value.map((row) => (
          <li key={row.place} className="flex items-center gap-4 px-4 py-2">
            <span className="w-20 shrink-0 font-mono text-sm text-muted">{row.place} место</span>
            <div className="max-w-40 flex-1">
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                aria-label={`Баллы за ${row.place} место`}
                value={String(row.points)}
                onChange={(event) => setPoints(row.place, event.target.value)}
              />
            </div>
            <span className="text-sm text-muted">баллов</span>
          </li>
        ))}
        {!value.length && <li className="px-4 py-3 text-sm text-muted">Мест пока нет</li>}
      </ul>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          leftIcon={<IconPlus size={16} />}
          onClick={() => onChange([...value, { place: value.length + 1, points: 0 }])}
        >
          Добавить место
        </Button>
        {value.length > 0 && (
          <IconButton
            aria-label="Убрать последнее место"
            icon={<IconMinus size={16} />}
            size="sm"
            onClick={() => onChange(value.slice(0, -1))}
          />
        )}
        <span className="text-sm text-muted">Места вне таблицы — 0 баллов</span>
      </div>
      {error && <p className="text-sm text-danger-text">{error}</p>}
    </div>
  )
}
