import { personAvatar } from '@/entities/person'
import { useState, type FormEvent } from 'react'
import { useResultsForm, type ResultEntry, type ResultsScope } from '@/entities/result'
import { plural } from '@/shared/lib'
import {
  Button,
  Checkbox,
  EmptyState,
  ErrorState,
  FormAlert,
  Input,
  Modal,
  PersonLine,
  Skeleton,
} from '@/shared/ui'
import { placesValid, type PlaceDraft } from '../model/places'
import { useSaveResults } from '../model/use-save-results'

const fromEntry = (entry: ResultEntry): PlaceDraft => ({
  place: entry.place != null ? String(entry.place) : '',
  disqualified: entry.entered && entry.place == null,
})

const entryTitle = (entry: ResultEntry) =>
  entry.team_name ?? entry.athletes[0]?.full_name ?? `Заявка №${entry.application_id}`

/**
 * Места всем одобренным участникам: команда занимает одно место на всех.
 * Сохраняется всё сразу, места пересоздаются и тут же видны на странице и в рейтинге.
 */
export function ResultsModal({
  scope,
  contest,
  open,
  onClose,
}: {
  scope: ResultsScope
  contest: { id: number; title: string }
  open: boolean
  onClose: () => void
}) {
  const form = useResultsForm(scope, contest.id, open)
  const save = useSaveResults(scope, contest.id)
  const [edits, setEdits] = useState<Record<number, PlaceDraft>>({})
  const [error, setError] = useState<string | null>(null)
  const entries = form.data?.items ?? []
  const editable = form.data?.editable ?? false
  const value = (entry: ResultEntry) => edits[entry.application_id] ?? fromEntry(entry)
  const change = (entry: ResultEntry, next: Partial<PlaceDraft>) => {
    setError(null)
    setEdits((current) => ({ ...current, [entry.application_id]: { ...value(entry), ...next } }))
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const drafts = entries.map((entry) => ({ entry, draft: value(entry) }))
    if (drafts.some(({ draft }) => !draft.disqualified && !draft.place)) {
      setError('Укажите место или дисквалификацию у каждого участника')
      return
    }
    const places = drafts.filter(({ draft }) => !draft.disqualified).map(({ draft }) => Number(draft.place))
    if (places.some((place) => !Number.isInteger(place) || place < 1)) {
      setError('Место — целое число от 1')
      return
    }
    if (!placesValid(places)) {
      setError('Места идут подряд с 1 и не повторяются')
      return
    }
    save.mutate(
      drafts.map(({ entry, draft }) => ({
        application_id: entry.application_id,
        place: draft.disqualified ? null : Number(draft.place),
      })),
      { onSuccess: onClose },
    )
  }

  const team = form.data?.participation_type === 'team'
  const count = entries.length
  const alert = error ?? save.error?.message

  return (
    <Modal
      size="xl"
      open={open}
      onClose={onClose}
      onSubmit={submit}
      title="Места участников"
      description={
        form.data
          ? `${contest.title} · ${count} ${plural(count, team ? ['команда', 'команды', 'команд'] : ['участник', 'участника', 'участников'])}`
          : contest.title
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" loading={save.isPending} disabled={!editable || !count}>
            Сохранить места
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {alert && <FormAlert>{alert}</FormAlert>}
        {form.data && !editable && (
          <FormAlert tone="info">Места вносятся, пока соревнование идёт или после завершения</FormAlert>
        )}
        {form.isPending ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3, 4].map((id) => (
              <Skeleton key={id} className="h-16 rounded-lg" />
            ))}
          </div>
        ) : form.isError ? (
          <ErrorState error={form.error} onRetry={() => form.refetch()} />
        ) : !count ? (
          <EmptyState
            title="Одобренных заявок нет"
            description="Места вносятся только одобренным участникам"
          />
        ) : (
          <>
            <p className="text-sm text-muted">
              Места идут подряд с 1 и не повторяются. Дисквалифицированные — без места
            </p>
            <ul className="flex flex-col divide-y divide-line-soft overflow-hidden rounded-lg border border-line-soft">
              {entries.map((entry) => {
                const draft = value(entry)
                const title = entryTitle(entry)
                return (
                  <li
                    key={entry.application_id}
                    className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:gap-5 sm:px-5"
                  >
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      {entry.team_name ? (
                        <>
                          <span className="text-body text-ink">{entry.team_name}</span>
                          <ul className="flex flex-col gap-2">
                            {entry.athletes.map((athlete) => (
                              <li key={athlete.id}>
                                <PersonLine
                                  size="sm"
                                  name={athlete.full_name}
                                  avatar={personAvatar(athlete.id)}
                                />
                              </li>
                            ))}
                          </ul>
                        </>
                      ) : (
                        <PersonLine
                          name={title}
                          avatar={entry.athletes[0] ? personAvatar(entry.athletes[0].id) : null}
                        />
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <Input
                        aria-label={`Место: ${title}`}
                        type="number"
                        inputMode="numeric"
                        min={1}
                        className="w-24 font-mono tabular-nums"
                        placeholder="Место"
                        disabled={draft.disqualified || !editable}
                        value={draft.disqualified ? '' : draft.place}
                        onChange={(event) => change(entry, { place: event.target.value })}
                      />
                      <Checkbox
                        label="Дисквалификация"
                        checked={draft.disqualified}
                        disabled={!editable}
                        onChange={(event) => change(entry, { disqualified: event.target.checked })}
                      />
                    </div>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </div>
    </Modal>
  )
}
