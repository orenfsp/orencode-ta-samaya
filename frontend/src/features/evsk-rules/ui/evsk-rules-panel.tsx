import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useDictionaryOptions } from '@/entities/dictionary'
import { evskApi, evskKeys, useEvskRules, type EvskRule } from '@/entities/evsk'
import { ApiError } from '@/shared/api'
import {
  Button,
  ConfirmModal,
  DataTable,
  EmptyState,
  ErrorState,
  Field,
  FormAlert,
  IconPlus,
  Input,
  MetaTag,
  Modal,
  Select,
  Switch,
  type Column,
} from '@/shared/ui'

const columns: Column<EvskRule>[] = [
  { key: 'rank', header: 'Разряд', primary: true, cell: (rule) => rule.rank_type.name },
  { key: 'level', header: 'Уровень', cell: (rule) => rule.contest_level.name },
  {
    key: 'place',
    header: 'Места',
    cell: (rule) => <span className="font-mono tabular-nums">1–{rule.place_to}</span>,
  },
  {
    key: 'conditions',
    header: 'Условия',
    hideBelow: 'lg',
    cell: (rule) =>
      [
        rule.discipline?.name,
        rule.min_participants ? `от ${rule.min_participants} участников` : null,
        rule.min_age ? `с ${rule.min_age} лет` : null,
        rule.max_age ? `до ${rule.max_age} лет` : null,
      ]
        .filter(Boolean)
        .join(', ') || '—',
  },
  {
    key: 'demo',
    header: 'Источник',
    cell: (rule) => (rule.is_demo ? <MetaTag>Демо</MetaTag> : (rule.source ?? '—')),
  },
]

function RuleModal({ open, rule, onClose }: { open: boolean; rule: EvskRule | null; onClose: () => void }) {
  const client = useQueryClient()
  const ranks = useDictionaryOptions('rank_types')
  const levels = useDictionaryOptions('contest_levels')
  const disciplines = useDictionaryOptions('disciplines')
  const [rank, setRank] = useState(rule ? String(rule.rank_type.id) : '')
  const [level, setLevel] = useState(rule ? String(rule.contest_level.id) : '')
  const [discipline, setDiscipline] = useState(rule?.discipline ? String(rule.discipline.id) : '')
  const [place, setPlace] = useState(rule ? String(rule.place_to) : '3')
  const [participants, setParticipants] = useState(rule ? String(rule.min_participants) : '0')
  const [minAge, setMinAge] = useState(rule?.min_age ? String(rule.min_age) : '')
  const [maxAge, setMaxAge] = useState(rule?.max_age ? String(rule.max_age) : '')
  const [source, setSource] = useState(rule?.source ?? '')
  const [demo, setDemo] = useState(rule?.is_demo ?? false)
  const save = useMutation({
    mutationFn: () => {
      const body = {
        rank_type_id: Number(rank),
        contest_level_id: Number(level),
        discipline_id: discipline ? Number(discipline) : null,
        place_to: Number(place),
        min_participants: Number(participants) || 0,
        min_age: minAge ? Number(minAge) : null,
        max_age: maxAge ? Number(maxAge) : null,
        source: source.trim() || null,
        is_demo: demo,
        note: null,
      }
      return rule ? evskApi.updateRule(rule.id, body) : evskApi.createRule(body)
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: evskKeys.all })
      onClose()
    },
  })
  const error = save.error instanceof ApiError ? save.error : null
  const options = (items: { id: number; name: string }[] | undefined) =>
    (items ?? []).map((item) => ({ value: String(item.id), label: item.name }))
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (rank && level && Number(place) >= 1) save.mutate()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={rule ? 'Правило ЕВСК' : 'Новое правило ЕВСК'}
      onSubmit={onSubmit}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" loading={save.isPending} disabled={!rank || !level}>
            Сохранить
          </Button>
        </>
      }
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Разряд" required error={error?.field('rank_type_id')} className="sm:col-span-2">
          <Select
            value={rank}
            onChange={(event) => setRank(event.target.value)}
            placeholder="Выберите"
            options={options(ranks.data)}
          />
        </Field>
        <Field label="Уровень соревнования" required error={error?.field('contest_level_id')}>
          <Select
            value={level}
            onChange={(event) => setLevel(event.target.value)}
            placeholder="Выберите"
            options={options(levels.data)}
          />
        </Field>
        <Field label="Дисциплина" hint="Пусто — любая">
          <Select
            value={discipline}
            onChange={(event) => setDiscipline(event.target.value)}
            options={[{ value: '', label: 'Любая' }, ...options(disciplines.data)]}
          />
        </Field>
        <Field label="Места до" required>
          <Input
            type="number"
            min={1}
            max={100}
            className="font-mono tabular-nums"
            value={place}
            onChange={(event) => setPlace(event.target.value)}
          />
        </Field>
        <Field label="Минимум участников или команд">
          <Input
            type="number"
            min={0}
            className="font-mono tabular-nums"
            value={participants}
            onChange={(event) => setParticipants(event.target.value)}
          />
        </Field>
        <Field label="Возраст с">
          <Input
            type="number"
            min={5}
            className="font-mono tabular-nums"
            value={minAge}
            onChange={(event) => setMinAge(event.target.value)}
          />
        </Field>
        <Field label="Возраст до" error={error?.field('max_age')}>
          <Input
            type="number"
            min={5}
            className="font-mono tabular-nums"
            value={maxAge}
            onChange={(event) => setMaxAge(event.target.value)}
          />
        </Field>
        <Field label="Источник нормы" hint="Приказ или документ ФСП России" className="sm:col-span-2">
          <Input value={source} maxLength={300} onChange={(event) => setSource(event.target.value)} />
        </Field>
        <Switch label="Демо-значение" checked={demo} onChange={(event) => setDemo(event.target.checked)} />
        {save.isError && !Object.keys(error?.fields ?? {}).length && (
          <FormAlert className="sm:col-span-2">{save.error.message}</FormAlert>
        )}
      </div>
    </Modal>
  )
}

/** Правила ЕВСК федерации: место на соревновании уровня → разряд. По ним подсвечиваются протоколы */
export function EvskRulesPanel() {
  const rules = useEvskRules()
  const client = useQueryClient()
  const [form, setForm] = useState<{ open: boolean; rule: EvskRule | null; key: number }>({
    open: false,
    rule: null,
    key: 0,
  })
  const [removing, setRemoving] = useState<{ open: boolean; rule: EvskRule | null }>({
    open: false,
    rule: null,
  })
  const open = (rule: EvskRule | null) => setForm((state) => ({ open: true, rule, key: state.key + 1 }))
  const demo = rules.data?.some((rule) => rule.is_demo)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {demo ? (
          <FormAlert tone="info">
            Часть норм демонстрационная: официальные нормы ЕВСК по спортивному программированию внесите по
            документам ФСП России
          </FormAlert>
        ) : (
          <span />
        )}
        <Button leftIcon={<IconPlus size={18} />} onClick={() => open(null)}>
          Добавить правило
        </Button>
      </div>
      {rules.isError ? (
        <ErrorState error={rules.error} onRetry={() => rules.refetch()} />
      ) : (
        <DataTable
          caption="Правила ЕВСК"
          columns={[
            ...columns,
            {
              key: 'actions',
              header: <span className="sr-only">Действия</span>,
              actions: true,
              cell: (rule) => (
                <Button variant="text" size="sm" onClick={() => setRemoving({ open: true, rule })}>
                  Удалить
                </Button>
              ),
            },
          ]}
          rows={rules.data ?? []}
          rowKey={(rule) => rule.id}
          loading={rules.isPending}
          onRowClick={open}
          empty={<EmptyState title="Правил нет" description="Добавьте нормы ЕВСК: уровень, места и разряд" />}
        />
      )}
      <RuleModal
        key={form.key}
        open={form.open}
        rule={form.rule}
        onClose={() => setForm((state) => ({ ...state, open: false }))}
      />
      <ConfirmModal
        open={removing.open}
        onClose={() => setRemoving((state) => ({ ...state, open: false }))}
        title="Удалить правило"
        description={
          removing.rule
            ? `${removing.rule.rank_type.name}: ${removing.rule.contest_level.name}, места 1–${removing.rule.place_to}`
            : undefined
        }
        confirmLabel="Удалить"
        tone="danger"
        onConfirm={async () => {
          if (!removing.rule) return
          await evskApi.removeRule(removing.rule.id)
          void client.invalidateQueries({ queryKey: evskKeys.all })
          setRemoving((state) => ({ ...state, open: false }))
        }}
      />
    </div>
  )
}
