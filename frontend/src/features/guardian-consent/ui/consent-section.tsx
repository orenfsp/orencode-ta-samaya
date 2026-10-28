import { useMutation } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useMyConsent, type Consent } from '@/entities/consent'
import { fileApi } from '@/entities/file'
import { ApiError } from '@/shared/api'
import { formatDate } from '@/shared/lib'
import {
  Button,
  ErrorState,
  Facts,
  Field,
  FileDrop,
  FormAlert,
  Input,
  Skeleton,
  Spinner,
  StatusTag,
} from '@/shared/ui'
import { CONSENT_ACCEPT, consentStatusTitles, consentTones } from '../model/labels'
import { useConsentActions } from '../model/use-consent-actions'

function ConsentForm({ current, onSent }: { current: Consent | null; onSent: () => void }) {
  const actions = useConsentActions()
  const [name, setName] = useState(current?.guardian_name ?? '')
  const [phone, setPhone] = useState(current?.guardian_phone ?? '')
  const [file, setFile] = useState<{ id: string; name: string } | null>(null)
  const upload = useMutation({
    mutationFn: fileApi.upload,
    onSuccess: (stored) => setFile({ id: stored.id, name: stored.original_name }),
  })
  const error = actions.submit.error instanceof ApiError ? actions.submit.error : null

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!file) return
    actions.submit.mutate(
      { guardian_name: name.trim(), guardian_phone: phone.trim(), file_id: file.id },
      { onSuccess: onSent },
    )
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      {error && !Object.keys(error.fields).length && <FormAlert>{error.message}</FormAlert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="ФИО представителя" required error={error?.field('guardian_name')}>
          <Input value={name} maxLength={300} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field label="Телефон представителя" required error={error?.field('guardian_phone')}>
          <Input
            type="tel"
            inputMode="tel"
            value={phone}
            maxLength={40}
            placeholder="+7 900 000-00-00"
            onChange={(event) => setPhone(event.target.value)}
          />
        </Field>
      </div>
      {file ? (
        <div className="flex items-center justify-between gap-3 rounded-md border border-line-soft px-4 py-3">
          <span className="min-w-0 truncate text-body text-ink">{file.name}</span>
          <Button variant="text" size="sm" onClick={() => setFile(null)}>
            Заменить
          </Button>
        </div>
      ) : (
        <FileDrop
          label="Скан подписанного согласия"
          hint="PDF, DOCX или фото, до 10 МБ"
          accept={CONSENT_ACCEPT}
          value={upload.isPending ? (upload.variables ?? null) : null}
          onChange={(picked) => picked && upload.mutate(picked)}
          error={error?.field('file_id') ?? (upload.isError ? upload.error.message : undefined)}
        />
      )}
      {upload.isPending && (
        <span className="flex items-center gap-2 text-sm text-muted">
          <Spinner className="size-4" /> Загружаем…
        </span>
      )}
      <div className="flex justify-end">
        <Button
          type="submit"
          loading={actions.submit.isPending}
          disabled={!file || !name.trim() || !phone.trim()}
        >
          Отправить на проверку
        </Button>
      </div>
    </form>
  )
}

/**
 * Согласие законного представителя — только до 18 лет. Без одобренного федерацией согласия
 * заявку на соревнование не подать ни самому, ни тренеру.
 */
export function ConsentSection() {
  const mine = useMyConsent()
  const [editing, setEditing] = useState(false)
  if (mine.isPending) return <Skeleton className="h-40 rounded-lg" />
  if (mine.isError) return <ErrorState error={mine.error} onRetry={() => mine.refetch()} />
  if (!mine.data.required) return null
  const consent = mine.data.consent
  const showForm = !consent || consent.status === 'rejected' || editing

  return (
    <section className="flex flex-col gap-4" aria-label="Согласие представителя">
      <div className="flex flex-col gap-1">
        <h2 className="text-h3 font-medium">Согласие законного представителя</h2>
        <p className="text-body text-muted">Нужно до 18 лет, чтобы подавать заявки на соревнования</p>
      </div>
      <div className="flex flex-col gap-5 card p-5 sm:p-6">
        {consent ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <StatusTag tone={consentTones[consent.status]}>{consentStatusTitles[consent.status]}</StatusTag>
              {consent.status === 'pending' && !editing && (
                <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
                  Заменить скан
                </Button>
              )}
            </div>
            {consent.status === 'rejected' && consent.reject_reason && (
              <FormAlert>Причина отказа: {consent.reject_reason}</FormAlert>
            )}
            <Facts
              items={[
                { label: 'Представитель', value: consent.guardian_name },
                { label: 'Телефон', value: consent.guardian_phone },
                {
                  label: 'Скан',
                  value: (
                    <a
                      href={consent.file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="link-underline"
                    >
                      {consent.file.original_name}
                    </a>
                  ),
                },
                { label: 'Отправлено', value: formatDate(consent.submitted_at) },
              ]}
            />
          </div>
        ) : (
          <FormAlert tone="info">
            Пока нет одобренного согласия, заявку на соревнование подать нельзя. Подпишите согласие у родителя
            или опекуна и загрузите скан — его проверит федерация.
          </FormAlert>
        )}
        {showForm && (
          <div className={consent ? 'border-t border-line-soft pt-5' : undefined}>
            <ConsentForm current={consent} onSent={() => setEditing(false)} />
          </div>
        )}
      </div>
    </section>
  )
}
