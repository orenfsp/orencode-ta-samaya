import { useMutation } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { resultApi, type ImportPreview, type ResultEntry, type ResultsScope } from '@/entities/result'
import { ApiError } from '@/shared/api'
import { Button, FormAlert, IconUpload, Select, StatusTag } from '@/shared/ui'

/** Строку не переносить, даже если платформа предложила заявку */
const SKIP = -1

const title = (entry: ResultEntry) =>
  entry.team_name ?? entry.athletes[0]?.full_name ?? `Заявка №${entry.application_id}`

/**
 * Импорт протокола из xlsx или PDF: платформа сопоставляет строки с одобренными заявками по ФИО (ё/е, регистр)
 * и названию команды. Сомнительные и ненайденные строки разбираются вручную, места переносятся в форму ниже
 */
export function ProtocolImport({
  scope,
  contestId,
  entries,
  onApply,
}: {
  scope: ResultsScope
  contestId: number
  entries: ResultEntry[]
  onApply: (preview: ImportPreview, chosen: Record<number, number>) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [chosen, setChosen] = useState<Record<number, number>>({})
  const load = useMutation({
    mutationFn: (file: File) => resultApi.importPreview(scope, contestId, file),
    onSuccess: (data) => {
      setPreview(data)
      setChosen({})
    },
  })
  const error = load.error instanceof ApiError ? (load.error.field('file') ?? load.error.message) : null
  const review = preview?.rows.filter((row) => row.status !== 'matched') ?? []
  const missing = preview ? entries.filter((entry) => preview.missing.includes(entry.application_id)) : []

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-line-soft p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-ink">Импорт протокола</span>
          <span className="text-sm text-muted">xlsx или PDF: место, ФИО или команда, баллы по желанию</span>
        </div>
        <Button
          variant="secondary"
          leftIcon={<IconUpload size={18} />}
          loading={load.isPending}
          onClick={() => input.current?.click()}
        >
          Загрузить файл
        </Button>
        <input
          ref={input}
          type="file"
          hidden
          accept=".xlsx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) load.mutate(file)
            event.target.value = ''
          }}
        />
      </div>
      {error && <FormAlert>{error}</FormAlert>}
      {preview && (
        <>
          <p className="font-mono text-sm text-muted tabular-nums">
            {preview.file_name}: совпали {preview.matched}, сомнительные {preview.doubtful}, не найдены{' '}
            {preview.unmatched}
          </p>
          {review.length > 0 && (
            <ul className="flex flex-col divide-y divide-line-soft rounded-lg border border-line-soft">
              {review.map((row) => (
                <li
                  key={row.line}
                  className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="flex items-center gap-2">
                      <StatusTag tone={row.status === 'doubtful' ? 'draft' : 'cancelled'}>
                        {row.status === 'doubtful' ? 'Проверьте' : 'Не найден'}
                      </StatusTag>
                      <span className="truncate text-ink">{row.name}</span>
                    </span>
                    <span className="text-sm text-muted">
                      Строка {row.line} · {row.disqualified ? 'дисквалификация' : `место ${row.place}`}
                      {row.note && ` · ${row.note}`}
                    </span>
                  </span>
                  <Select
                    aria-label={`Заявка для строки ${row.line}`}
                    className="sm:w-72"
                    value={
                      chosen[row.line] === SKIP ? '' : String(chosen[row.line] ?? row.application_id ?? '')
                    }
                    onChange={(event) =>
                      setChosen((state) => ({
                        ...state,
                        [row.line]: event.target.value ? Number(event.target.value) : SKIP,
                      }))
                    }
                    options={[
                      { value: '', label: 'Не переносить' },
                      ...entries
                        .filter(
                          (entry) =>
                            !row.candidates.length ||
                            row.candidates.includes(entry.application_id) ||
                            row.status === 'unmatched',
                        )
                        .map((entry) => ({ value: String(entry.application_id), label: title(entry) })),
                    ]}
                  />
                </li>
              ))}
            </ul>
          )}
          {missing.length > 0 && (
            <p className="text-sm text-muted">
              Нет в файле: {missing.map(title).join(', ')}. Место или дисквалификацию укажите в форме ниже
            </p>
          )}
          <div className="flex justify-end">
            <Button onClick={() => onApply(preview, chosen)}>Перенести места в форму</Button>
          </div>
        </>
      )}
    </section>
  )
}
