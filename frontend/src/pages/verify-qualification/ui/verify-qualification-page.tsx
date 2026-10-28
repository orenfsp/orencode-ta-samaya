import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router'
import { qualificationApi } from '@/entities/qualification'
import { ApiError } from '@/shared/api'
import { routes } from '@/shared/config'
import { formatDate } from '@/shared/lib'
import {
  Breadcrumbs,
  Button,
  EmptyState,
  ErrorState,
  Facts,
  IconShieldCheck,
  IconShieldX,
  Skeleton,
  StatusTag,
} from '@/shared/ui'

/** Проверка разряда или судейской категории по QR: без входа и без лишних персональных данных */
export function VerifyQualificationPage() {
  const { token = '' } = useParams()
  const check = useQuery({
    queryKey: ['qualifications', 'verify', token],
    queryFn: ({ signal }) => qualificationApi.verify(token, signal),
    retry: false,
  })
  const data = check.data
  const missing = check.error instanceof ApiError && check.error.status === 404

  return (
    <article className="container-page flex max-w-prose flex-col gap-6 py-8 sm:py-12">
      <Breadcrumbs items={[{ label: 'Главная', to: routes.home }, { label: 'Проверка разряда' }]} />
      {check.isPending ? (
        <Skeleton className="h-64 rounded-lg" />
      ) : missing ? (
        <EmptyState
          title="Запись не найдена"
          description="QR-код не относится к разрядам и категориям ФСП Оренбургской области"
          action={<Button to={routes.home}>На главную</Button>}
        />
      ) : check.isError ? (
        <ErrorState error={check.error} onRetry={() => check.refetch()} />
      ) : (
        data && (
          <section className="flex flex-col gap-5 card rounded-lg p-5 sm:p-6">
            <div className="flex items-start gap-3">
              {data.valid ? (
                <IconShieldCheck size={28} className="shrink-0 text-primary-text" />
              ) : (
                <IconShieldX size={28} className="shrink-0 text-live-text" />
              )}
              <div className="flex flex-col gap-1">
                <span className="text-sm text-muted">{data.kind_title}</span>
                <h1 className="text-h2 font-medium">{data.item_name}</h1>
              </div>
            </div>
            {!data.valid && (
              <p className="text-live-text">Подпись не совпала: запись изменена после присвоения</p>
            )}
            <Facts
              layout="row"
              items={[
                { label: 'Кому', value: data.person },
                {
                  label: 'Статус',
                  value: (
                    <StatusTag tone={data.status === 'Действует' ? 'active' : 'cancelled'}>
                      {data.status}
                    </StatusTag>
                  ),
                },
                data.valid_from ? { label: 'Присвоено', value: formatDate(data.valid_from) } : null,
                {
                  label: 'Действует до',
                  value: data.valid_until ? formatDate(data.valid_until) : 'Бессрочно',
                },
                Boolean(data.order_number) && {
                  label: 'Приказ',
                  value: `${data.order_number}${data.order_date ? ` от ${formatDate(data.order_date)}` : ''}`,
                },
              ]}
            />
            <p className="text-sm text-muted">Региональное отделение ФСП Оренбургской области</p>
          </section>
        )
      )}
    </article>
  )
}
