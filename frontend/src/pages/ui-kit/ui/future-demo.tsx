import { useState } from 'react'
import { useSelection } from '@/shared/lib'
import {
  BarList,
  Button,
  Card,
  Checkbox,
  ColumnChart,
  DocumentSheet,
  KindTag,
  NotificationBell,
  PersonLine,
  PhotoGrid,
  PlaceMark,
  RankingList,
  RosterSlots,
  SelectionBar,
  ShareBar,
  SignatureLine,
  StatTile,
  StatusTag,
  Timeline,
  TimelineItem,
  TimelineYear,
  type NotificationItem,
  type RosterMember,
} from '@/shared/ui'
import { Row, Section } from './section'

// Фото-заглушки витрины: плоские плашки цветов бренда, без внешних картинок
const photo = (fill: string, label: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="${fill}"/><text x="40" y="560" font-family="monospace" font-size="40" fill="#EDEDED">${label}</text></svg>`,
  )}`
const photos = [
  { id: '1', url: photo('#402FFF', 'финал'), alt: 'Финал' },
  { id: '2', url: photo('#1B1C21', 'награждение'), alt: 'Награждение' },
  { id: '3', url: photo('#EC1D35', 'команда'), alt: 'Команда' },
  { id: '4', url: photo('#2B2C33', 'зал'), alt: 'Зал' },
  { id: '5', url: photo('#402FFF', 'разбор'), alt: 'Разбор задач' },
]

const people = [
  'Демидов Арсений',
  'Корнеева Вера',
  'Ильин Тимур',
  'Сафина Алия',
  'Гордеев Марк',
  'Лапина Ева',
  'Носов Кирилл',
  'Белова Дарья',
  'Зуев Глеб',
  'Ахметова Сабина',
  'Кравец Лев',
  'Орлова Мира',
  'Пак Даниил',
  'Шевчук Ника',
]
const ranking = people.map((name, index) => ({
  id: String(index),
  place: index + 1,
  name,
  meta: index % 2 ? 'г. Орск · МАОУ «Лицей № 1»' : 'г. Оренбург · ОГУ',
  points: Math.round(980 / (1 + index * 0.35)),
}))

const notifications: NotificationItem[] = [
  {
    id: '1',
    title: 'Заявка принята',
    text: 'Первенство области по алгоритмическому программированию',
    time: '5 мин назад',
    unread: true,
  },
  {
    id: '2',
    title: 'Вас назначили судьёй',
    text: 'Кубок Оренбуржья, заместитель главного судьи',
    time: 'сегодня, 09:12',
    unread: true,
  },
  { id: '3', title: 'Роль тренера подтверждена', time: 'вчера, 18:20' },
]

const applications = [
  { id: 'a1', name: 'Демидов Арсений', meta: '15 лет · г. Оренбург' },
  { id: 'a2', name: 'Корнеева Вера', meta: '16 лет · г. Орск' },
  { id: 'a3', name: 'Ильин Тимур', meta: '14 лет · Бузулукский район' },
]

/** Заготовки под план: запись и команды, модерация, рейтинг, уведомления, портфолио, аналитика, документы */
export function FutureDemo() {
  const [team, setTeam] = useState<RosterMember[]>([
    { id: 'c', name: 'Демидов Арсений', captain: true },
    { id: 'm1', name: 'Корнеева Вера', meta: 'II разряд' },
  ])
  const selection = useSelection<string>()
  const ids = applications.map((item) => item.id)

  return (
    <>
      <Section
        id="people"
        title="Заявки и команды"
        description="Строка человека, состав команды по слотам, выбор строк с панелью массовых действий для модерации."
        className="grid gap-8 lg:grid-cols-2"
      >
        <RosterSlots
          members={team}
          min={3}
          max={5}
          onAdd={() =>
            setTeam((current) => [
              ...current,
              {
                id: `m${current.length + 1}`,
                name: people[current.length + 1] ?? 'Новый участник',
                meta: 'без разряда',
              },
            ])
          }
          onRemove={(id) => setTeam((current) => current.filter((member) => member.id !== id))}
        />
        <div className="flex flex-col gap-3">
          <Checkbox
            label="Все заявки"
            checked={selection.allOf(ids)}
            indeterminate={selection.someOf(ids)}
            onChange={() => selection.toggleAll(ids)}
          />
          <ul className="flex flex-col divide-y divide-line-soft rounded-md border border-line-soft">
            {applications.map((item) => (
              <li key={item.id} className="flex items-center gap-3 px-3 py-2.5">
                <Checkbox
                  aria-label={`Выбрать: ${item.name}`}
                  checked={selection.has(item.id)}
                  onChange={() => selection.toggle(item.id)}
                />
                <PersonLine
                  className="flex-1"
                  name={item.name}
                  meta={item.meta}
                  trailing={<StatusTag tone="draft">На проверке</StatusTag>}
                />
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted">Отметьте заявки — снизу появится панель действий.</p>
        </div>
        <SelectionBar count={selection.count} onClear={selection.clear} noun={['заявка', 'заявки', 'заявок']}>
          <Button size="sm">Принять</Button>
          <Button size="sm" variant="ghost">
            Отклонить
          </Button>
        </SelectionBar>
      </Section>

      <Section
        id="rating"
        title="Места и рейтинг"
        description="Рейтинг группы за 366 дней: топ-5 крупными строками, следующие 10 — тонкими."
        className="flex flex-col gap-8"
      >
        <Row label="Место">
          <PlaceMark place={1} size="lg" />
          <PlaceMark place={2} size="lg" />
          <PlaceMark place={3} size="lg" />
          <PlaceMark place={4} size="lg" />
          <PlaceMark place={12} />
        </Row>
        <RankingList
          title="Алгоритмическое программирование · 14–17 лет"
          caption="за 366 дней · обновлено сегодня"
          rows={ranking}
        />
      </Section>

      <Section id="notifications" title="Уведомления" className="flex flex-col gap-6">
        <Row label="Колокольчик в шапке и сайдбаре">
          <NotificationBell items={notifications} onReadAll={() => {}} allTo="#notifications" />
        </Row>
      </Section>

      <Section
        id="portfolio"
        title="Портфолио"
        description="Лента выступлений и обслуживаний: дата, карточка соревнования, своя заметка и фото."
      >
        <Timeline>
          <TimelineYear year={2026} />
          <TimelineItem date="14 нояб." caption="2 дня">
            <Card className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <KindTag kind="contest" />
                <PlaceMark place={2} size="sm" />
                <span className="text-sm text-muted">командное, 3 человека</span>
              </div>
              <h3 className="text-h3 font-medium">Кубок Оренбуржья по продуктовому программированию</h3>
              <p className="text-body text-muted">
                Делали сервис записи в секции. Не успели с мобильной версией, зато защита прошла ровно.
              </p>
              <PhotoGrid photos={photos} />
            </Card>
          </TimelineItem>
          <TimelineYear year={2025} />
          <TimelineItem date="3 окт." caption="судья" accent="muted" last>
            <Card className="flex flex-col gap-3">
              <KindTag kind="contest" />
              <h3 className="text-h3 font-medium">Первенство области по алгоритмическому программированию</h3>
              <PhotoGrid photos={photos.slice(0, 1)} />
            </Card>
          </TimelineItem>
        </Timeline>
      </Section>

      <Section id="analytics" title="Аналитика" className="flex flex-col gap-8">
        <div className="grid gap-4 sm:grid-cols-3">
          <StatTile label="Участий за год" value={1284} delta={212} hint="к прошлому году" />
          <StatTile label="Соревнований" value={37} delta={-3} />
          <StatTile label="Обслужено как судья" value={9} />
        </div>
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted">Участия по месяцам</p>
            <ColumnChart
              highlight={9}
              data={['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'].map(
                (label, index) => ({
                  label,
                  value: [40, 62, 88, 120, 96, 30, 12, 18, 140, 176, 150, 90][index]!,
                }),
              )}
            />
          </div>
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted">Участия по дисциплинам</p>
            <BarList
              data={[
                { label: 'Алгоритмическое', value: 520 },
                { label: 'Продуктовое', value: 310 },
                { label: 'Информационная безопасность', value: 190 },
                { label: 'Искусственный интеллект', value: 140 },
                { label: 'Робототехника', value: 80 },
                { label: 'БАС', value: 44 },
              ]}
            />
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted">Участия по возрастным группам</p>
          <ShareBar
            data={[
              { label: 'до 13 лет', value: 210, tone: 'muted' },
              { label: '14–17 лет', value: 640, tone: 'primary' },
              { label: '18+', value: 380, tone: 'ink' },
              { label: 'студенты', value: 54, tone: 'live' },
            ]}
          />
        </div>
      </Section>

      <Section
        id="documents"
        title="Документы"
        description="Лист приказа или справки: всегда «бумага», печатается без интерфейса, подлинность — по QR на эту же страницу."
        className="bg-surface-3 p-3 sm:p-8"
      >
        <DocumentSheet
          kind="Справка"
          number="2026-0142"
          date="27.10.2026"
          title="об участии в официальных соревнованиях"
          verifyUrl="https://fsp56.ru/verify/7f3c2a10-9b1e-4d2f-a8c4-0e5b6d7c8f90"
          signatures={<SignatureLine role="Руководитель регионального отделения" name="И. И. Иванов" />}
        >
          <p>
            Выдана Демидову Арсению Сергеевичу, 12.03.2010 г. р., в том, что он принял участие в Первенстве
            Оренбургской области по алгоритмическому программированию 14–15 ноября 2026 года и занял 2 место в
            группе 14–17 лет.
          </p>
          <p>Справка выдана для предъявления по месту требования.</p>
        </DocumentSheet>
      </Section>
    </>
  )
}
