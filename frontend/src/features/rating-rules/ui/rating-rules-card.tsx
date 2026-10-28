import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { ratingApi, ratingKeys, useRatingRules, type RatingRules, type RatingSeason } from '@/entities/rating'
import { useMe } from '@/entities/session'
import { ApiError } from '@/shared/api'
import { formatDate } from '@/shared/lib'
import { Button, Field, FormAlert, Input, Modal, Select, Skeleton } from '@/shared/ui'

function RulesModal({ open, rules, onClose }: { open: boolean; rules: RatingRules; onClose: () => void }) {
  const client = useQueryClient()
  const [factor, setFactor] = useState(String(rules.stability_factor))
  const [place, setPlace] = useState(String(rules.podium_place))
  const [count, setCount] = useState(String(rules.podium_count))
  const [season, setSeason] = useState<RatingSeason>(rules.season)
  const save = useMutation({
    mutationFn: () =>
      ratingApi.saveRules({
        stability_factor: Number(factor.replace(',', '.')),
        podium_place: Number(place),
        podium_count: Number(count),
        season,
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ratingKeys.all })
      void client.invalidateQueries({ queryKey: ['squads'] })
      onClose()
    },
  })
  const error = save.error instanceof ApiError ? save.error : null
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    save.mutate()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title="Правила рейтинга"
      onSubmit={onSubmit}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" loading={save.isPending}>
            Сохранить
          </Button>
        </>
      }
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Сезон" className="sm:col-span-2">
          <Select
            value={season}
            onChange={(event) => setSeason(event.target.value as RatingSeason)}
            options={[
              { value: 'rolling', label: 'Последние 365 дней' },
              { value: 'calendar', label: 'Календарный год' },
            ]}
          />
        </Field>
        <Field
          label="Коэффициент стабильности"
          hint="1 — без коэффициента"
          error={error?.field('stability_factor')}
          className="sm:col-span-2"
        >
          <Input
            inputMode="decimal"
            className="font-mono tabular-nums"
            value={factor}
            onChange={(event) => setFactor(event.target.value)}
          />
        </Field>
        <Field label="Призовые места до" error={error?.field('podium_place')}>
          <Input
            type="number"
            min={1}
            max={10}
            className="font-mono tabular-nums"
            value={place}
            onChange={(event) => setPlace(event.target.value)}
          />
        </Field>
        <Field
          label="Призёр не менее чем на"
          hint="соревнованиях сезона"
          error={error?.field('podium_count')}
        >
          <Input
            type="number"
            min={1}
            max={10}
            className="font-mono tabular-nums"
            value={count}
            onChange={(event) => setCount(event.target.value)}
          />
        </Field>
        {save.isError && !Object.keys(error?.fields ?? {}).length && (
          <FormAlert className="sm:col-span-2">{save.error.message}</FormAlert>
        )}
      </div>
    </Modal>
  )
}

/** Как считается рейтинг: формула для всех, правка правил — сотруднику федерации */
export function RatingRulesCard() {
  const rules = useRatingRules()
  const { data: me } = useMe()
  const [edit, setEdit] = useState({ open: false, key: 0 })
  const federation = me?.roles.some((item) => item.role === 'federation' && item.status === 'verified')

  if (rules.isPending) return <Skeleton className="h-20 rounded-lg" />
  if (rules.isError) return null

  return (
    <div className="flex flex-wrap items-start justify-between gap-4 card px-5 py-4">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-body text-ink">{rules.data.formula}</span>
        <span className="text-sm text-muted">
          Сезон с {formatDate(rules.data.since)}. У каждого спортсмена видно, как сложился итог
        </span>
      </div>
      {federation && (
        <Button variant="secondary" onClick={() => setEdit((state) => ({ open: true, key: state.key + 1 }))}>
          Изменить правила
        </Button>
      )}
      <RulesModal
        key={edit.key}
        open={edit.open}
        rules={rules.data}
        onClose={() => setEdit((state) => ({ ...state, open: false }))}
      />
    </div>
  )
}
