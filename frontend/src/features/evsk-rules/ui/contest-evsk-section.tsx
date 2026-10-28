import { useContestEvsk } from '@/entities/evsk'
import { EvskCandidates } from './evsk-candidates'

/** На странице соревнования для организатора и федерации: кто по протоколу может претендовать на разряд */
export function ContestEvskSection({ contestId, enabled }: { contestId: number; enabled: boolean }) {
  const candidates = useContestEvsk(contestId, enabled)
  if (!enabled || candidates.isError || (candidates.isSuccess && !candidates.data.length)) return null
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-h3 font-medium">Могут претендовать на разряд</h2>
      <p className="text-sm text-muted">
        Подсказка по нормам ЕВСК. Решение принимает федерация по заявке спортсмена или тренера
      </p>
      <EvskCandidates items={candidates.data ?? []} loading={candidates.isPending} />
    </section>
  )
}
