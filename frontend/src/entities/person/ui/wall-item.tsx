import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { statusTitles, statusTone } from '@/entities/competition'
import { routes } from '@/shared/config'
import { Card, IconEyeOff, PhotoGrid, PlaceMark, StatusTag } from '@/shared/ui'
import { athletesLabel } from '../lib/describe'
import type { WallEntry } from '../model/types'

/** Пост ленты: соревнование, занятое место, с кем выступал, заметка владельца и фото. footer — действия владельца или федерации */
export function WallItem({ entry, footer }: { entry: WallEntry; footer?: ReactNode }) {
  const { contest, post } = entry
  const hidden = post && (post.is_hidden || post.hidden_by_federation)
  const meta = [
    contest.discipline.name,
    entry.team_name && `команда «${entry.team_name}»`,
    entry.athletes != null && athletesLabel(entry.athletes),
    entry.position,
    entry.athletes != null && entry.place != null && `лучшее место — ${entry.place}`,
    entry.disqualified && 'дисквалификация',
  ].filter(Boolean)
  const place = entry.athletes == null ? entry.place : null

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        {(hidden || contest.status !== 'completed') && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {contest.status !== 'completed' && (
              <StatusTag tone={statusTone[contest.status]}>{statusTitles[contest.status]}</StatusTag>
            )}
            {hidden && (
              <span className="inline-flex items-center gap-1.5 text-sm text-muted">
                <IconEyeOff size={16} />
                {post.hidden_by_federation ? 'Скрыт федерацией' : 'Скрыт, виден только вам'}
              </span>
            )}
          </div>
        )}
        <div className="flex items-start gap-3">
          {place != null && <PlaceMark place={place} />}
          <h3 className="min-w-0 text-lead font-medium hyphens-auto sm:text-h3">
            <Link
              to={routes.competition(contest.id)}
              className="rounded-sm link-underline focus-visible:field-focus"
            >
              {contest.title}
            </Link>
          </h3>
        </div>
        <p className="text-sm text-muted">{meta.join(' · ')}</p>
      </div>
      {post?.text && <p className="text-body break-words whitespace-pre-wrap text-ink">{post.text}</p>}
      {post && post.photos.length > 0 && (
        <PhotoGrid photos={post.photos.map((photo) => ({ ...photo, alt: contest.title }))} />
      )}
      {footer && <div className="flex flex-wrap gap-2 border-t border-line-soft pt-4">{footer}</div>}
    </Card>
  )
}
