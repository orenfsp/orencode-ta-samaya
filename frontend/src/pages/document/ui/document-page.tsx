import { useParams } from 'react-router'
import { documentApi, useVerifiedDocument, type VerifiedDocument } from '@/entities/document'
import { ApiError } from '@/shared/api'
import { routes } from '@/shared/config'
import { formatDate } from '@/shared/lib'
import {
  Breadcrumbs,
  Button,
  DocumentSheet,
  EmptyState,
  ErrorState,
  FormAlert,
  IconDownload,
  SignatureLine,
  Skeleton,
  VerifiedMark,
} from '@/shared/ui'

const roleTitles = { athlete: 'Спортсмен', coach: 'Тренер', judge: 'Судья' } as const

function Facts({ document }: { document: VerifiedDocument }) {
  const rows: [string, string | null][] = [
    ['Соревнование', document.contest.title],
    ['Дисциплина', document.contest.discipline],
    ['Даты', document.contest.dates],
    ['Место проведения', document.contest.place],
    ['Роль', roleTitles[document.role]],
    ['Должность', document.position],
    ['Команда', document.team],
    ['Место', document.place ? String(document.place) : null],
    ['Организатор', document.contest.organizer],
  ]
  return (
    <dl className="grid gap-x-6 gap-y-2 border-t border-line pt-4 text-sm sm:grid-cols-[12rem_minmax(0,1fr)]">
      {rows
        .filter(([, value]) => value)
        .map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted">{label}</dt>
            <dd className="text-ink">{value}</dd>
          </div>
        ))}
    </dl>
  )
}

/** Сюда ведёт QR-код документа: подтверждает, что документ выдан на платформе, и показывает его содержание */
export function DocumentPage() {
  const { token = '' } = useParams()
  const query = useVerifiedDocument(token)

  if (query.isPending)
    return (
      <div className="container-page flex flex-col gap-6 py-12">
        <Skeleton className="h-14 rounded-md" />
        <Skeleton className="mx-auto h-[36rem] w-full max-w-[52rem] rounded-lg" />
      </div>
    )
  if (query.isError)
    return (
      <div className="container-page py-12">
        {query.error instanceof ApiError && [404, 422].includes(query.error.status) ? (
          <EmptyState
            title="Документ не найден"
            description="Его заменили новым выпуском или убрали. Если QR-код с бумаги — уточните у выдавшего"
            action={<Button to={routes.home}>На главную</Button>}
          />
        ) : (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        )}
      </div>
    )

  const document = query.data
  const reference = document.kind === 'reference'

  if (!document.valid)
    return (
      <div className="container-page py-12">
        <EmptyState
          title={`Документ № ${document.number} недействителен`}
          description="Подпись не сходится: данные документа изменены в обход платформы. Не принимайте его"
          action={<Button to={routes.home}>На главную</Button>}
        />
      </div>
    )

  return (
    <div className="container-page flex flex-col gap-6 py-8 sm:py-12">
      <Breadcrumbs
        items={[
          { label: 'Главная', to: routes.home },
          { label: document.contest.title, to: routes.competition(document.contest.id) },
          { label: `Документ № ${document.number}` },
        ]}
      />
      <div className="mx-auto flex w-full max-w-[52rem] flex-col gap-4">
        <FormAlert tone="success">
          <span className="flex items-center gap-2">
            <VerifiedMark />
            Подлинный документ: выдан на платформе ФСП Оренбургской области и действует
          </span>
        </FormAlert>
        <div className="flex flex-wrap gap-2">
          <Button href={documentApi.pdfUrl(document.token)} leftIcon={<IconDownload size={18} />}>
            Скачать PDF
          </Button>
          <Button variant="secondary" to={routes.competition(document.contest.id)}>
            Страница соревнования
          </Button>
        </div>
      </div>

      <DocumentSheet
        kind={reference ? 'Справка' : document.title}
        number={document.number}
        date={formatDate(document.issued_on)}
        title={reference ? document.title : document.recipient}
        verifyUrl={window.location.href}
        signatures={
          document.signer_name || document.signer_position ? (
            <SignatureLine role={document.signer_position ?? ''} name={document.signer_name ?? ''} />
          ) : undefined
        }
      >
        {reference ? (
          <p>
            Подтверждает, что {document.recipient}{' '}
            {document.role === 'judge'
              ? `входил(а) в судейскую коллегию соревнования «${document.contest.title}».`
              : document.role === 'coach'
                ? `в качестве тренера подготовил(а) спортсменов к соревнованию «${document.contest.title}».`
                : `принял(а) участие в соревновании «${document.contest.title}»${
                    document.place ? ` и занял(а) ${document.place} место` : ''
                  }.`}
          </p>
        ) : (
          document.lead && <p className="text-muted">{document.lead}</p>
        )}
        {document.text && <p>{document.text}</p>}
        {document.athletes.length > 0 && (
          <ul>
            {document.athletes.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}
        <Facts document={document} />
      </DocumentSheet>
    </div>
  )
}
