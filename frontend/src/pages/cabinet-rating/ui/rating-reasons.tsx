import { useMyRatingStatus } from '@/entities/rating'
import { FormAlert, Skeleton } from '@/shared/ui'

/** Почему спортсмена нет в рейтинге или в части рейтингов: причины считает сервер по его сезону */
export function RatingReasons() {
  const status = useMyRatingStatus()

  if (status.isPending) return <Skeleton className="h-24 rounded-lg" />
  if (status.isError || !status.data.reasons.length) return null

  return (
    <section className="flex flex-col gap-3 card px-5 py-4">
      <h2 className="text-lead font-medium text-ink">
        {status.data.in_rating ? 'Почему вас нет в части рейтингов' : 'Почему вас нет в рейтинге'}
      </h2>
      <ul className="flex list-disc flex-col gap-2 pl-5 text-body text-ink">
        {status.data.reasons.map((reason) => (
          <li key={reason.code}>{reason.text}</li>
        ))}
      </ul>
      <FormAlert tone="info">{status.data.rules.formula}</FormAlert>
    </section>
  )
}
