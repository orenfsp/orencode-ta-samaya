import { personAvatar } from '@/entities/person'
import { useState } from 'react'
import { personName, useAthleteSearch, type AthleteFound } from '@/entities/application'
import { formatDate } from '@/shared/lib'
import { Button, EmptyState, Field, IconSearch, Input, PersonLine, Skeleton } from '@/shared/ui'

/**
 * Поиск спортсмена для заявки: по части ФИО или email, от 2 символов, слова в любом порядке.
 * Сервер сразу говорит, кто не проходит на это соревнование и почему, — таких не добавить.
 */
export function AthletePicker({
  contestId,
  exclude,
  onPick,
  pendingId,
  label = 'Найти спортсмена',
  addedLabel = 'В составе',
  inputId,
}: {
  contestId: number
  /** Уже в составе — показываем, но не даём добавить второй раз */
  exclude: string[]
  onPick: (athlete: AthleteFound) => void
  pendingId?: string | null
  /** Подпись у уже выбранных: «В составе» для команды, «Выбран» для пачки личных заявок */
  addedLabel?: string
  label?: string
  /** id обёртки: слот «Добавить участника» в составе ставит фокус в поле поиска внутри неё */
  inputId?: string
}) {
  const [q, setQ] = useState('')
  const search = useAthleteSearch(q, contestId)
  const text = q.trim()

  return (
    <div id={inputId} className="flex flex-col gap-3">
      <Field label={label} hint="Начните вводить фамилию, имя или почту">
        <Input
          type="search"
          maxLength={200}
          leftIcon={<IconSearch size={18} />}
          value={q}
          onChange={(event) => setQ(event.target.value)}
        />
      </Field>
      {text.length < 2 ? null : search.isPending ? (
        <div className="flex flex-col gap-2">
          {[1, 2].map((id) => (
            <Skeleton key={id} className="h-16 rounded-md" />
          ))}
        </div>
      ) : search.isError ? (
        <p className="text-sm text-live-text">{search.error.message}</p>
      ) : !search.data?.length ? (
        <EmptyState title="Никого не нашли" description="Проверьте написание или введите email полностью" />
      ) : (
        <ul className="flex flex-col gap-2" aria-busy={search.isFetching}>
          {search.data.map((athlete) => {
            const added = exclude.includes(athlete.id)
            const problems = athlete.problems ?? []
            return (
              <li key={athlete.id} className="rounded-md border border-line-soft px-3 py-2.5">
                <PersonLine
                  name={personName(athlete)}
                  avatar={personAvatar(athlete.id)}
                  meta={[formatDate(athlete.birth_date), athlete.academic_group?.name]
                    .filter(Boolean)
                    .join(' · ')}
                  trailing={
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={added || problems.length > 0}
                      loading={pendingId === athlete.id}
                      onClick={() => onPick(athlete)}
                    >
                      {added ? addedLabel : 'Добавить'}
                    </Button>
                  }
                />
                {problems.length > 0 && (
                  <p className="mt-2 pl-[3.25rem] text-sm text-live-text">{problems.join('; ')}</p>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
