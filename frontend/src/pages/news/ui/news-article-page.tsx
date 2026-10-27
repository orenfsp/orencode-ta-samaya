import { Link, useParams } from 'react-router'
import { ArticleContent, NewsCover, newsDate, useArticle } from '@/entities/news'
import { ApiError } from '@/shared/api'
import { routes } from '@/shared/config'
import { plural } from '@/shared/lib'
import { Breadcrumbs, Button, EmptyState, ErrorState, Skeleton } from '@/shared/ui'

/** Статья: дата и раздел над заголовком, анонс, обложка, блоки, хэштеги ссылками на ленту */
export function NewsArticlePage() {
  const { slug = '' } = useParams()
  const article = useArticle(slug)

  if (article.isPending)
    return (
      <div className="container-page flex max-w-3xl flex-col gap-6 py-8 sm:py-12">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-24" />
        <Skeleton className="aspect-video rounded-lg" />
      </div>
    )

  if (article.isError)
    return (
      <div className="container-page py-8 sm:py-12">
        {article.error instanceof ApiError && article.error.status === 404 ? (
          <EmptyState
            title="Статья не найдена"
            description="Возможно, её сняли с публикации"
            action={<Button to={routes.news}>Все новости</Button>}
          />
        ) : (
          <ErrorState error={article.error} onRetry={() => article.refetch()} />
        )}
      </div>
    )

  const item = article.data
  return (
    <article className="container-page flex max-w-3xl flex-col gap-8 py-8 sm:py-12">
      <Breadcrumbs
        items={[
          { label: 'Главная', to: routes.home },
          { label: 'Новости', to: routes.news },
          { label: item.title },
        ]}
      />
      <header className="flex flex-col gap-4">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-sm text-muted">
          {item.published_at && <time dateTime={item.published_at}>{newsDate(item.published_at)}</time>}
          {item.section && (
            <Link
              to={`${routes.news}?section=${encodeURIComponent(item.section)}`}
              className="text-primary-text hover:underline"
            >
              {item.section}
            </Link>
          )}
        </p>
        <h1 className="text-h1 font-medium text-balance break-words">{item.title}</h1>
        {item.summary && <p className="text-lead text-muted">{item.summary}</p>}
      </header>

      {item.cover_file_id && (
        <NewsCover fileId={item.cover_file_id} alt="" className="rounded-xl" label={item.section} />
      )}

      <ArticleContent blocks={item.blocks} />

      <footer className="flex flex-col gap-4 border-t border-line-soft pt-6">
        {item.hashtags.length > 0 && (
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-body">
            {item.hashtags.map((tag) => (
              <Link
                key={tag}
                to={`${routes.news}?tag=${encodeURIComponent(tag)}`}
                className="text-primary-text hover:underline"
              >
                #{tag}
              </Link>
            ))}
          </p>
        )}
        <p className="font-mono text-xs text-muted">
          {item.views} {plural(item.views, ['просмотр', 'просмотра', 'просмотров'])}
        </p>
      </footer>
    </article>
  )
}
