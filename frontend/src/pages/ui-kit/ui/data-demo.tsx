import { useState } from 'react'
import { formatDate } from '@/shared/lib'
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  ErrorState,
  IconCalendar,
  IconMapPin,
  MetaTag,
  Skeleton,
  SkeletonText,
  Table,
  Tabs,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@/shared/ui'
import { Section } from './section'

// Демо-данные явно вымышленные
const rows = [
  { place: 1, name: 'Демидов Арсений', org: 'Лицей № 1', points: 102 },
  { place: 2, name: 'Корнеева Вера', org: 'ОГУ', points: 85 },
  { place: 2, name: 'Литвинов Матвей', org: 'СШ «Прогресс»', points: 85 },
  { place: 4, name: 'Яблокова Дарья', org: 'Без организации', points: 40 },
]

type View = 'data' | 'loading' | 'empty' | 'error'

export function DataDemo() {
  const [view, setView] = useState<View>('data')

  return (
    <Section
      id="data"
      title="Данные"
      description="У каждого экрана с данными 4 состояния: загрузка, пусто, ошибка, данные. Переключите и посмотрите."
    >
      <div className="flex flex-col gap-6">
        <Tabs
          aria-label="Состояние списка"
          value={view}
          onChange={setView}
          items={[
            { value: 'data', label: 'Данные' },
            { value: 'loading', label: 'Загрузка' },
            { value: 'empty', label: 'Пусто' },
            { value: 'error', label: 'Ошибка' },
          ]}
        />

        {view === 'data' && (
          <div className="animate-rise">
            <Table>
              <THead>
                <tr>
                  <TH className="w-16">Место</TH>
                  <TH>Спортсмен</TH>
                  <TH>Организация</TH>
                  <TH className="text-right">Баллы</TH>
                </tr>
              </THead>
              <TBody>
                {rows.map((row) => (
                  <TR key={row.name}>
                    <TD className="font-bold">{row.place}</TD>
                    <TD>
                      <span className="flex items-center gap-3">
                        <Avatar name={row.name} size="sm" />
                        <span className="whitespace-nowrap">{row.name}</span>
                      </span>
                    </TD>
                    <TD className="whitespace-nowrap text-muted">{row.org}</TD>
                    <TD className="text-right font-bold">{row.points}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        )}

        {view === 'loading' && (
          <div className="flex flex-col gap-4 card p-5">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="flex items-center gap-3">
                <Skeleton className="size-8 rounded-full" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        )}

        {view === 'empty' && (
          <div className="card">
            <EmptyState
              title="В рейтинге пока никого"
              description="Рейтинг появится после публикации первого протокола в этой дисциплине"
              action={
                <Button variant="secondary" onClick={() => setView('data')}>
                  Сбросить фильтры
                </Button>
              }
            />
          </div>
        )}

        {view === 'error' && (
          <div className="card">
            <ErrorState onRetry={() => setView('loading')} />
          </div>
        )}
      </div>
    </Section>
  )
}

export function CardsDemo() {
  return (
    <Section
      id="cards"
      title="Карточки"
      description="Кликабельная карточка на ховере приподнимается и светлеет. Название события — один раз, без дубля."
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      <Card to="#cards" className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          <MetaTag accent>Онлайн</MetaTag>
          <MetaTag>14-18</MetaTag>
        </div>
        <h3 className="text-h3 font-medium text-ink">
          Первенство области по алгоритмическому программированию
        </h3>
        <div className="mt-auto flex flex-col gap-1.5 text-sm text-muted">
          <span className="flex items-center gap-2">
            <IconCalendar size={16} /> {formatDate('2026-11-14')}
          </span>
          <span className="flex items-center gap-2">
            <IconMapPin size={16} /> по месту нахождения участников
          </span>
        </div>
      </Card>
      <Card to="#cards" className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          <MetaTag>Оффлайн</MetaTag>
          <MetaTag>16+</MetaTag>
        </div>
        <h3 className="text-h3 font-medium text-ink">Кубок региона по продуктовому программированию</h3>
        <div className="mt-auto flex flex-col gap-1.5 text-sm text-muted">
          <span className="flex items-center gap-2">
            <IconCalendar size={16} /> {formatDate('2026-12-05')}
          </span>
          <span className="flex items-center gap-2">
            <IconMapPin size={16} /> г. Оренбург
          </span>
        </div>
      </Card>
      <Card className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Avatar name="Корнеева Вера" size="lg" />
          <div className="flex flex-col">
            <span className="text-body font-bold text-ink">Корнеева Вера</span>
            <span className="text-sm text-muted">КМС · до {formatDate('2028-03-01')}</span>
          </div>
        </div>
        <SkeletonText lines={2} />
      </Card>
    </Section>
  )
}
