import type { ReactNode } from 'react'
import { routes } from '@/shared/config'
import { cn } from '@/shared/lib'
import { Card, StatusTag, type StatusTone } from '@/shared/ui'
import { newsDate } from '../lib/describe'
import type { Article } from '../model/types'
import { NewsCover } from './news-cover'

/**
 * Карточка статьи: обложка, дата и раздел, заголовок, анонс, хэштеги.
 * На сайте вся карточка ссылка; в кабинете вместо ссылки снизу встают действия (footer).
 */
export function NewsCard({
  article,
  status,
  footer,
  className,
}: {
  article: Article
  /** Статус в кабинете; на сайте только опубликованные, без статуса */
  status?: { tone: StatusTone; title: string }
  footer?: ReactNode
  className?: string
}) {
  return (
    <Card
      to={footer ? undefined : routes.newsArticle(article.slug)}
      padding="none"
      className={cn('flex h-full flex-col overflow-hidden', className)}
    >
      <NewsCover fileId={article.cover_file_id} label={article.section} />
      <div className="flex flex-1 flex-col gap-3 p-5">
        {status && <StatusTag tone={status.tone}>{status.title}</StatusTag>}
        <p className="font-mono text-xs text-muted">
          {article.published_at && newsDate(article.published_at)}
          {article.published_at && article.section && ' · '}
          {article.section}
        </p>
        <h3 className="line-clamp-3 text-h3 font-medium text-balance">{article.title}</h3>
        {article.summary && <p className="line-clamp-3 text-body text-muted">{article.summary}</p>}
        {(article.hashtags.length > 0 || footer) && (
          <div className="mt-auto flex flex-col gap-4 pt-2">
            {article.hashtags.length > 0 && (
              <p className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-primary-text">
                {article.hashtags.map((tag) => (
                  <span key={tag}>#{tag}</span>
                ))}
              </p>
            )}
            {footer}
          </div>
        )}
      </div>
    </Card>
  )
}
