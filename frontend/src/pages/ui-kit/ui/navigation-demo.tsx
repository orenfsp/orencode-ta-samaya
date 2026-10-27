import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { cn } from '@/shared/lib'
import {
  IconButton,
  IconChevronDown,
  IconDownload,
  IconFile,
  IconUser,
  Menu,
  Pagination,
  showToast,
} from '@/shared/ui'
import { Row, Section } from './section'

const roles = [
  { id: 'athlete', label: 'Спортсмен' },
  { id: 'coach', label: 'Тренер' },
  { id: 'judge', label: 'Судья' },
]

const TOTAL_PAGES = 12

export function NavigationDemo() {
  const [role, setRole] = useState('athlete')
  const [params] = useSearchParams()
  const page = Math.min(Math.max(Number(params.get('page')) || 1, 1), TOTAL_PAGES)
  const current = roles.find((item) => item.id === role)

  return (
    <Section
      id="navigation"
      title="Меню и страницы"
      description="Меню — для смены роли без повторного входа и действий у строки. Стрелки, Home/End, Escape. Пагинация на телефоне превращается в «Показать ещё». У иконочных кнопок подсказка появляется сама из aria-label."
      className="flex flex-col gap-8"
    >
      <Row label="Смена роли">
        <Menu
          aria-label="Роль"
          items={roles.map((item) => ({
            id: item.id,
            label: item.label,
            selected: item.id === role,
            onSelect: () => {
              setRole(item.id)
              showToast(`Кабинет: ${item.label.toLowerCase()}`, { tone: 'success' })
            },
          }))}
          trigger={(props) => (
            <button
              type="button"
              {...props}
              className="group inline-flex min-h-11 pressable items-center gap-2.5 rounded-md bg-surface-3 py-2 pr-3 pl-3.5 text-body text-ink hover:bg-line"
            >
              <IconUser size={18} className="text-muted" />
              {current?.label}
              <IconChevronDown
                size={18}
                className={cn(
                  'text-muted transition-[rotate] duration-220 ease-emphasized',
                  props['aria-expanded'] && 'rotate-180',
                )}
              />
            </button>
          )}
        />
        <Menu
          align="end"
          aria-label="Выгрузки"
          items={[
            {
              id: 'xlsx',
              label: 'Протокол, .xlsx',
              icon: <IconDownload size={18} />,
              onSelect: () => showToast('Выгрузка началась'),
            },
            {
              id: 'pdf',
              label: 'Протокол, .pdf',
              icon: <IconFile size={18} />,
              onSelect: () => showToast('Выгрузка началась'),
            },
          ]}
          trigger={(props) => (
            <IconButton
              {...props}
              aria-label="Скачать протокол"
              icon={<IconDownload />}
              variant="secondary"
            />
          )}
        />
      </Row>

      <Row label={`Страница ${page} из ${TOTAL_PAGES}`}>
        <Pagination
          page={page}
          totalPages={TOTAL_PAGES}
          hrefFor={(target) => `?page=${target}#navigation`}
          onMore={() => showToast('Догрузили следующую страницу')}
          className="w-full md:w-auto"
        />
      </Row>
    </Section>
  )
}
