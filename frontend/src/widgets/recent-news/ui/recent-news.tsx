import { NewsCard, useNews } from '@/entities/news'
import { routes } from '@/shared/config'
import { Button, ErrorState, IconArrowRight, Skeleton } from '@/shared/ui'

/** Три свежие статьи на главной. Новостей нет — блока нет: пустая секция на лендинге ничего не даёт */
export function RecentNews() {
  const news = useNews({}, 3)
  if (news.isSuccess && !news.data.items.length) return null

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 className="text-h2 font-medium">Новости</h2>
        <Button to={routes.news} variant="paper" rightIcon={<IconArrowRight size={18} />}>
          Все новости
        </Button>
      </div>
      {news.isPending ? (
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((id) => (
            <Skeleton key={id} className="h-80 rounded-lg" />
          ))}
        </div>
      ) : news.isError ? (
        <ErrorState error={news.error} onRetry={() => news.refetch()} />
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {news.data.items.map((article) => (
            <NewsCard key={article.id} article={article} />
          ))}
        </div>
      )}
    </section>
  )
}
