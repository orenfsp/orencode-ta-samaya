import { useState } from 'react'
import { routes } from '@/shared/config'
import {
  Accordion,
  Avatar,
  Badge,
  Breadcrumbs,
  Button,
  Eyebrow,
  IconArrowRight,
  IconButton,
  IconDownload,
  IconPlus,
  IconSearch,
  KindTag,
  MetaTag,
  StatusTag,
  Stepper,
  Tabs,
  TextLink,
  ThemeToggle,
  VerifiedMark,
} from '@/shared/ui'
import { CardsDemo, DataDemo } from './data-demo'
import { FutureDemo } from './future-demo'
import { FormsDemo } from './forms-demo'
import { NavigationDemo } from './navigation-demo'
import { OverlaysDemo } from './overlays-demo'
import { Row, Section } from './section'

// Токены, а не hex: плитки перекрашиваются вместе с темой — так видно, что обе темы собраны из одной палитры
const palette = [
  { name: 'primary', note: 'действие, выбор', className: 'bg-primary text-white' },
  { name: 'live', note: 'идёт, сегодня, отмена', className: 'bg-live text-white' },
  { name: 'canvas', note: 'фон страницы', className: 'bg-canvas text-ink border border-line' },
  { name: 'surface', note: 'карточки', className: 'bg-surface text-ink border border-line-soft' },
  { name: 'surface-3', note: 'подложки', className: 'bg-surface-3 text-ink' },
  { name: 'paper', note: 'шапка, плашки', className: 'bg-paper text-on-paper border border-line-soft' },
  { name: 'ink / muted', note: 'текст', className: 'bg-ink text-canvas' },
  {
    name: 'primary-text',
    note: 'синий текстом',
    className: 'bg-surface text-primary-text border border-line-soft',
  },
]

const toc = [
  ['palette', 'Палитра'],
  ['type', 'Типографика'],
  ['buttons', 'Кнопки'],
  ['badges', 'Метки'],
  ['tabs', 'Вкладки'],
  ['forms', 'Формы'],
  ['data', 'Данные'],
  ['cards', 'Карточки'],
  ['overlays', 'Окна'],
  ['navigation', 'Меню'],
  ['accordion', 'Аккордеон'],
  ['stepper', 'Шаги'],
  ['people', 'Заявки и команды'],
  ['rating', 'Рейтинг'],
  ['notifications', 'Уведомления'],
  ['portfolio', 'Портфолио'],
  ['analytics', 'Аналитика'],
  ['documents', 'Документы'],
] as const

const navigatorSteps = [
  { title: 'Заполните профиль', description: 'ФИО, дата рождения, муниципалитет и организация' },
  { title: 'Выберите дисциплины', description: 'Можно несколько — рейтинг считается по каждой отдельно' },
  {
    title: 'Скачайте согласие',
    description: 'Для участников младше 18 лет — подпись родителя или опекуна',
    actions: (
      <Button variant="secondary" size="sm" leftIcon={<IconDownload size={16} />}>
        Согласие, PDF
      </Button>
    ),
  },
  { title: 'Подайте первую заявку', description: 'Платформа сама покажет, куда вы проходите по возрасту' },
]

export function UiKitPage() {
  const [segment, setSegment] = useState('athlete')
  const [tab, setTab] = useState('profile')
  const [step, setStep] = useState(1)

  return (
    <div className="container-page flex flex-col gap-14 py-8 sm:py-12">
      <header className="flex flex-col gap-4">
        <Breadcrumbs items={[{ label: 'Главная', to: routes.home }, { label: 'UI-кит' }]} />
        <div className="flex items-center justify-between gap-4">
          <Eyebrow>Только в dev-сборке · /design</Eyebrow>
          <ThemeToggle />
        </div>
        <h1 className="text-h1 font-medium text-ink">Компонентная база</h1>
        <p className="max-w-2xl text-lead text-muted">
          Стиль fsp-russia.ru: тёмная база, светлые плашки, синий заливкой, JetBrains Mono и плавные переходы.
          Все примитивы лежат в{' '}
          <code className="rounded-xs bg-surface-2 px-1.5 py-0.5 text-sm">src/shared/ui</code>.
        </p>
        <nav aria-label="Разделы витрины" className="flex flex-wrap gap-2 pt-2">
          {toc.map(([id, label]) => (
            <a
              key={id}
              href={`#${id}`}
              className="pressable rounded-sm border border-line-soft px-3 py-1.5 text-sm text-ink hover:border-primary hover:text-primary-text"
            >
              {label}
            </a>
          ))}
        </nav>
      </header>

      <Section
        id="palette"
        title="Палитра"
        description="Пять цветов брендбука и белый, две темы — переключатель справа вверху. Синий — действия, красный — «живое и важное», не больше 1–2 раз на экран."
        className="grid grid-cols-2 gap-3 sm:grid-cols-4"
      >
        {palette.map((color) => (
          <div
            key={color.name}
            className={`flex aspect-[4/3] flex-col justify-end gap-1 rounded-lg p-4 ${color.className}`}
          >
            <span className="font-mono text-sm">{color.name}</span>
            <span className="text-xs opacity-80">{color.note}</span>
          </div>
        ))}
      </Section>

      <Section
        id="type"
        title="Типографика"
        description="Размеры плавно растут от телефона к десктопу."
        className="flex flex-col gap-5"
      >
        <p className="text-display font-medium text-ink">89</p>
        <p className="text-h1 font-medium text-ink">H1 Календарь соревнований</p>
        <p className="text-h2 font-medium text-ink">H2 Рейтинг спортсменов</p>
        <p className="text-h3 font-medium text-ink">H3 Заявки на модерации</p>
        <p className="text-lead text-ink">Lead — вводный абзац секции, чуть крупнее основного текста.</p>
        <p className="max-w-2xl text-body text-ink">
          Body — основной текст. Дата в тексте пишется как 13 октября 2026, в карточках — 09.10.2026.{' '}
          <TextLink href="https://rusada.ru">Материалы РУСАДА</TextLink> открываются в новой вкладке, а{' '}
          <TextLink to={routes.home}>внутренняя ссылка</TextLink> — через роутер.
        </p>
        <p className="text-sm text-muted">Small — подписи, метки, вторичный текст.</p>
      </Section>

      <Section
        id="buttons"
        title="Кнопки"
        description="Нажатие чуть проседает, стрелка справа на ховере едет вперёд. Светлая кнопка — как «Скачать брендбук» на сайте ФСП."
        className="flex flex-col gap-8"
      >
        <Row label="Варианты">
          <Button rightIcon={<IconArrowRight size={18} />}>Подать заявку</Button>
          <Button variant="secondary" leftIcon={<IconDownload size={18} />}>
            Положение, PDF
          </Button>
          <Button variant="outline" leftIcon={<IconPlus size={18} />}>
            Добавить
          </Button>
          <Button variant="ghost">Отмена</Button>
          <Button variant="danger">Удалить</Button>
        </Row>
        <Row label="Размеры">
          <Button size="sm">Маленькая</Button>
          <Button>Средняя</Button>
          <Button size="lg">Большая</Button>
        </Row>
        <Row label="Состояния">
          <Button loading>Сохранение</Button>
          <Button disabled>Недоступно</Button>
          <IconButton aria-label="Поиск" icon={<IconSearch />} variant="secondary" />
          <IconButton aria-label="Добавить" icon={<IconPlus />} variant="primary" />
          <IconButton aria-label="Скачать" icon={<IconDownload />} />
        </Row>
      </Section>

      <Section
        id="badges"
        title="Метки"
        description="Четыре вида — у каждого своя форма. Статус — точка, свойство — рамка, вид — иконка, верификация — щит у названия."
        className="flex flex-col gap-6"
      >
        <Row label="Статус">
          <StatusTag tone="draft">Черновик</StatusTag>
          <StatusTag tone="active">Регистрация открыта</StatusTag>
          <StatusTag tone="live">Идёт</StatusTag>
          <StatusTag tone="done">Завершено</StatusTag>
          <StatusTag tone="cancelled">Отменено</StatusTag>
        </Row>
        <Row label="Свойство">
          <MetaTag accent>Онлайн</MetaTag>
          <MetaTag>Оффлайн</MetaTag>
          <MetaTag>14-18</MetaTag>
          <MetaTag>Студенты</MetaTag>
        </Row>
        <Row label="Вид">
          <KindTag kind="contest" />
          <KindTag kind="event" />
        </Row>
        <Row label="Верификация">
          <span className="flex items-center gap-2 text-h3 font-medium">
            Кубок области <VerifiedMark />
          </span>
          <VerifiedMark state="pending" />
          <VerifiedMark state="rejected" reason="нет положения" />
        </Row>
        <Row label="Счётчик">
          <Badge>12</Badge>
        </Row>
        <Row label="Люди">
          <Avatar name="Демидов Арсений" size="sm" />
          <Avatar name="Корнеева Вера" />
          <Avatar name="Литвинов Матвей" size="lg" />
          <Avatar name="Яблокова Дарья" size="xl" />
        </Row>
      </Section>

      <Section
        id="tabs"
        title="Вкладки"
        description="Индикатор переезжает за активной вкладкой. Стрелки ← → тоже работают."
        className="flex flex-col gap-8"
      >
        <Tabs
          aria-label="Роль"
          value={segment}
          onChange={setSegment}
          items={[
            { value: 'athlete', label: 'Спортсмен' },
            { value: 'coach', label: 'Тренер' },
            { value: 'judge', label: 'Судья' },
            { value: 'organizer', label: 'Организатор' },
            { value: 'federation', label: 'Федерация' },
          ]}
        />
        <Tabs
          aria-label="Раздел профиля"
          variant="underline"
          value={tab}
          onChange={setTab}
          items={[
            { value: 'profile', label: 'Профиль' },
            { value: 'applications', label: 'Заявки' },
            { value: 'history', label: 'История выступлений' },
            { value: 'rank', label: 'Разряд' },
            { value: 'docs', label: 'Документы', disabled: true },
          ]}
        />
      </Section>

      <FormsDemo />
      <DataDemo />
      <CardsDemo />
      <OverlaysDemo />
      <NavigationDemo />

      <Section
        id="accordion"
        title="Аккордеон"
        description="Открыт один пункт, высота анимируется без скачков."
      >
        <Accordion
          items={[
            {
              id: 'ranks',
              title: 'Как получить спортивный разряд?',
              content:
                'Подайте заявку в личном кабинете, указав соревнование и результат. Федерация рассмотрит её и зафиксирует дату присвоения и срок действия.',
            },
            {
              id: 'minor',
              title: 'Мне нет 18 лет — что нужно для участия?',
              content:
                'Согласие родителя или опекуна на обработку персональных данных. Шаблон скачивается в кабинете, подписанный скан прикладывается к заявке.',
            },
            {
              id: 'rating',
              title: 'Как считается рейтинг?',
              content:
                'Баллы за места 1–3 с учётом уровня соревнования. Призёрам минимум двух соревнований — коэффициент стабильности ×1,2.',
            },
          ]}
        />
      </Section>

      <Section
        id="stepper"
        title="Шаги"
        description="Для навигатора новичка и пошаговых процессов."
        className="flex flex-col gap-6"
      >
        <Stepper steps={navigatorSteps} current={step} />
        <div className="flex gap-2 border-t border-line-soft pt-6">
          <Button variant="ghost" disabled={step === 0} onClick={() => setStep((value) => value - 1)}>
            Назад
          </Button>
          <Button
            disabled={step === navigatorSteps.length}
            onClick={() => setStep((value) => value + 1)}
            rightIcon={<IconArrowRight size={18} />}
          >
            Дальше
          </Button>
        </div>
      </Section>

      <FutureDemo />
    </div>
  )
}
