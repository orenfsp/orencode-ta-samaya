import { Link } from 'react-router'
import { IconTrophy } from '@/shared/ui'
import { useSquadBadges } from '../model/queries'

/** Метки «Участник сборной …» под именем на странице человека. Пока грузятся или их нет, блока нет */
export function SquadBadges({ userId }: { userId: string }) {
  const badges = useSquadBadges(userId)
  if (!badges.data?.length) return null
  return (
    <ul className="flex flex-col gap-1">
      {badges.data.map((badge) => (
        <li key={badge.squad_id} className="flex items-start gap-2 text-body">
          <IconTrophy size={18} className="mt-0.5 shrink-0 text-primary-text" aria-hidden="true" />
          <Link to={badge.link} className="link-underline text-ink focus-visible:field-focus">
            {badge.title}
          </Link>
        </li>
      ))}
    </ul>
  )
}
