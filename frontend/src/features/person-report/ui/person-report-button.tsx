import { useState } from 'react'
import { Button, DateInput, Field, FormAlert, IconDownload, Modal } from '@/shared/ui'
import { reportApi, useReportAccess } from '../api/report-api'

/**
 * Отчёт по человеку за период: соревнования, места, баллы, рейтинг, разряды, документы, сборные, судейство.
 * Кнопки нет, если сервер не разрешил: чужим отчёт не показываем.
 */
export function PersonReportButton({
  userId,
  enabled = true,
  variant = 'secondary',
}: {
  userId: string
  enabled?: boolean
  variant?: 'secondary' | 'primary'
}) {
  const access = useReportAccess(userId, enabled)
  const [open, setOpen] = useState(false)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  if (!access.data?.allowed) return null
  const since = from || access.data.date_from
  const until = to || access.data.date_to
  const wrong = since > until

  return (
    <>
      <Button variant={variant} leftIcon={<IconDownload size={18} />} onClick={() => setOpen(true)}>
        Отчёт
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        size="md"
        title="Отчёт по человеку"
        description="Соревнования, места и баллы, рейтинг, разряды, документы и сборные за период"
        footer={
          <>
            <Button
              variant="secondary"
              href={wrong ? undefined : reportApi.url(userId, 'xlsx', since, until)}
              disabled={wrong}
              leftIcon={<IconDownload size={18} />}
            >
              xlsx
            </Button>
            <Button
              href={wrong ? undefined : reportApi.url(userId, 'pdf', since, until)}
              external
              disabled={wrong}
              leftIcon={<IconDownload size={18} />}
            >
              PDF
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="С">
              <DateInput value={since} onChange={setFrom} max={until} />
            </Field>
            <Field label="По">
              <DateInput value={until} onChange={setTo} min={since} />
            </Field>
          </div>
          {wrong && <FormAlert>Начало периода позже конца</FormAlert>}
        </div>
      </Modal>
    </>
  )
}
