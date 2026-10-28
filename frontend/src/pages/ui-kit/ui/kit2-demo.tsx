import { useState } from 'react'
import {
  Button,
  CodeForm,
  DataTable,
  EmptyState,
  Facts,
  Field,
  IconSearch,
  Input,
  NotificationList,
  Pagination,
  SectionHeader,
  Select,
  Sheet,
  StatusTag,
  Toolbar,
  type Column,
  type SortDir,
} from '@/shared/ui'
import { Row, Section } from './section'

// Демо-данные явно вымышленные
interface Entry {
  id: number
  at: string
  author: string
  action: string
  object: string
  status: 'active' | 'draft' | 'cancelled'
}

const entries: Entry[] = [
  {
    id: 1,
    at: '27.10.2026 14:02',
    author: 'Демидов Арсений',
    action: 'Заявка одобрена',
    object: 'Кубок · команда «Ось»',
    status: 'active',
  },
  {
    id: 2,
    at: '27.10.2026 13:40',
    author: 'Корнеева Вера',
    action: 'Запрошена роль',
    object: 'Тренер',
    status: 'draft',
  },
  {
    id: 3,
    at: '26.10.2026 18:15',
    author: 'Литвинов Матвей',
    action: 'Соревнование отменено',
    object: 'Первенство ОГУ',
    status: 'cancelled',
  },
]

const statusTitles = { active: 'Одобрено', draft: 'На проверке', cancelled: 'Отменено' }

const columns: Column<Entry>[] = [
  {
    key: 'at',
    header: 'Время',
    cell: (row) => <span className="font-mono text-sm">{row.at}</span>,
    sortable: true,
    width: 'w-44',
  },
  { key: 'author', header: 'Автор', cell: (row) => row.author, primary: true },
  { key: 'action', header: 'Действие', cell: (row) => row.action },
  {
    key: 'object',
    header: 'Объект',
    cell: (row) => <span className="text-muted">{row.object}</span>,
    hideBelow: 'lg',
  },
  {
    key: 'status',
    header: 'Статус',
    cell: (row) => <StatusTag tone={row.status}>{statusTitles[row.status]}</StatusTag>,
  },
]

/** Надбавки кита 2: тулбар, таблица данных, факты, крупный код, панель уведомлений */
export function Kit2Demo() {
  const [sort, setSort] = useState<{ key: string; dir: SortDir }>({ key: 'at', dir: 'desc' })
  const [page, setPage] = useState(2)
  const [code, setCode] = useState('1')
  const [sheet, setSheet] = useState(false)
  const [view, setView] = useState<'data' | 'loading' | 'empty'>('data')
  const rows = sort.dir === 'asc' ? [...entries].reverse() : entries

  return (
    <>
      <Section
        id="tables"
        title="Таблицы"
        description="Любой список записей: тулбар сверху, сортировка заголовком, строка открывает детали. На телефоне — карточки."
        className="flex flex-col gap-4"
      >
        <SectionHeader
          as="h3"
          title="Журнал"
          action={
            <Select
              aria-label="Состояние"
              value={view}
              onChange={(event) => setView(event.target.value as typeof view)}
              options={[
                { value: 'data', label: 'Данные' },
                { value: 'loading', label: 'Загрузка' },
                { value: 'empty', label: 'Пусто' },
              ]}
            />
          }
        />
        <Toolbar
          search={
            <Field label="Поиск">
              <Input type="search" leftIcon={<IconSearch size={18} />} placeholder="ФИО или email" />
            </Field>
          }
          end={<Button variant="ghost">Сбросить</Button>}
        >
          <Field label="Действие">
            <Select options={[{ value: '', label: 'Любое' }]} />
          </Field>
          <Field label="Порядок">
            <Select
              options={[
                { value: 'desc', label: 'Сначала новые' },
                { value: 'asc', label: 'Сначала старые' },
              ]}
            />
          </Field>
        </Toolbar>
        <DataTable
          columns={columns}
          rows={view === 'empty' ? [] : rows}
          rowKey={(row) => row.id}
          loading={view === 'loading'}
          skeletonRows={3}
          sort={sort}
          onSort={(key, dir) => setSort({ key, dir })}
          onRowClick={() => setSheet(true)}
          empty={<EmptyState title="Записей не найдено" description="Измените фильтры" />}
        />
        <Pagination page={page} totalPages={12} onPage={setPage} />
      </Section>

      <Section id="kit2" title="Код, факты, панель" className="grid gap-8 lg:grid-cols-2">
        <Row label="Экран кода: регистрация, восстановление, смена почты">
          <CodeForm
            title="Подтвердите почту"
            email="sportsmen@example.test"
            onSubmit={() => setCode('')}
            error={code ? undefined : 'Неверный код. Осталось попыток: 4'}
            onResend={() => setCode('1')}
            resendIn={code ? 0 : 42}
          />
        </Row>
        <Row label="Факты">
          <Facts
            items={[
              { label: 'Номер', value: <span className="font-mono">ФСП-2026-000142</span> },
              { label: 'Соревнование', value: 'Кубок Оренбуржья по продуктовому программированию' },
              { label: 'Выдана', value: '27 октября 2026' },
            ]}
          />
        </Row>
        <Row label="Панель справа — только центр уведомлений">
          <div>
            <Button variant="secondary" onClick={() => setSheet(true)}>
              Открыть панель
            </Button>
          </div>
        </Row>
      </Section>

      <Sheet
        open={sheet}
        onClose={() => setSheet(false)}
        title="Уведомления"
        actions={
          <Button variant="text" size="sm">
            Прочитать все
          </Button>
        }
        footer={
          <Button variant="ghost" fullWidth>
            Все уведомления
          </Button>
        }
      >
        <NotificationList
          items={[
            {
              id: '1',
              title: 'Заявка одобрена',
              text: 'Заявка на Кубок одобрена.',
              time: '14:02',
              unread: true,
            },
            {
              id: '2',
              title: 'Роль подтверждена',
              text: 'Федерация подтвердила роль «Тренер».',
              time: 'вчера',
            },
          ]}
        />
      </Sheet>
    </>
  )
}
