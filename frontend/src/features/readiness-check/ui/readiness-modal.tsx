import { useReadiness, type ReadinessCheck } from '@/entities/deadline'
import { ErrorState, IconAlert, IconCheckCircle, Modal, Skeleton } from '@/shared/ui'

const STEPS: { value: ReadinessCheck['step']; title: string }[] = [
  { value: 'prepare', title: 'Подготовка' },
  { value: 'registration', title: 'Приём заявок' },
  { value: 'after', title: 'После старта' },
]

/** Чек-лист готовности: что сделано и что мешает следующему шагу. Всё считается из данных соревнования */
export function ReadinessModal({
  open,
  contest,
  onClose,
}: {
  open: boolean
  contest: { id: number; title: string }
  onClose: () => void
}) {
  const readiness = useReadiness(contest.id, open)
  const data = readiness.data

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title="Готовность соревнования"
      description={data ? `${contest.title} · готово ${data.done} из ${data.total}` : contest.title}
    >
      {readiness.isPending ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3, 4].map((id) => (
            <Skeleton key={id} className="h-12 rounded-lg" />
          ))}
        </div>
      ) : readiness.isError ? (
        <ErrorState error={readiness.error} onRetry={() => readiness.refetch()} />
      ) : (
        <div className="flex flex-col gap-6">
          {STEPS.map((step) => {
            const items = readiness.data.items.filter((item) => item.step === step.value)
            if (!items.length) return null
            return (
              <section key={step.value} className="flex flex-col gap-2">
                <h3 className="font-medium">{step.title}</h3>
                <ul className="flex flex-col divide-y divide-line-soft rounded-lg border border-line-soft">
                  {items.map((item) => (
                    <li key={item.key} className="flex items-start gap-3 px-4 py-3">
                      {item.done ? (
                        <IconCheckCircle size={20} className="mt-0.5 shrink-0 text-primary-text" />
                      ) : (
                        <span
                          className="mt-1 size-3.5 shrink-0 rounded-full border-2 border-line"
                          aria-hidden="true"
                        />
                      )}
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="text-ink">
                          {item.title}
                          <span className="sr-only">{item.done ? ' — готово' : ' — не готово'}</span>
                        </span>
                        {!item.done && <span className="text-sm text-muted">{item.hint}</span>}
                        {item.warning && (
                          <span className="flex items-center gap-1.5 text-sm text-live-text">
                            <IconAlert size={16} />
                            {item.warning}
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      )}
    </Modal>
  )
}
