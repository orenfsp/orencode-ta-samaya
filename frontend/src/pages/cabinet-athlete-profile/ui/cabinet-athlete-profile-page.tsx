import { useState } from 'react'
import { useCoachLinks, useSportProfile, linkTone, sexTitles, type CoachLink } from '@/entities/sport-profile'
import { LinkDetailsModal } from '@/features/coach-links'
import { AntidopingModal, SportProfileModal } from '@/features/sport-profile-edit'
import { routes } from '@/shared/config'
import { formatDate } from '@/shared/lib'
import {
  Button,
  EmptyState,
  ErrorState,
  Facts,
  IconExternal,
  IconPencil,
  IconPlus,
  PageHeader,
  SectionHeader,
  Skeleton,
  StatusTag,
} from '@/shared/ui'

const RUSADA = [
  { label: 'Онлайн-курс РУСАДА', href: 'https://rusada.ru/education/online-training/' },
  { label: 'Запрещённый список', href: 'https://rusada.ru/doping-control/prohibited-list/' },
  { label: 'Антидопинговые правила', href: 'https://rusada.ru/documents/' },
]

const day = (value: string) => formatDate(`${value}T12:00:00Z`)

/** Профиль спортсмена по кейсу: данные для реестра, тренеры с подтверждением, антидопинг */
export function CabinetAthleteProfilePage() {
  const profile = useSportProfile()
  const links = useCoachLinks()
  const [edit, setEdit] = useState({ open: false, key: 0 })
  const [antidoping, setAntidoping] = useState({ open: false, key: 0 })
  const [opened, setOpened] = useState<{ open: boolean; link: CoachLink | null }>({ open: false, link: null })

  const data = profile.data
  const incoming = (links.data?.as_athlete ?? []).filter((item) => item.status === 'requested')
  const coaches = (links.data?.as_athlete ?? []).filter(
    (item) => item.status === 'active' || item.status === 'suspended',
  )
  const latest = data?.antidoping[0]
  const today = new Date().toISOString().slice(0, 10)

  return (
    <section className="flex flex-col gap-10">
      <PageHeader
        title="Профиль спортсмена"
        crumbs={[
          { label: 'Главная', to: routes.home },
          { label: 'Кабинет', to: routes.cabinetRole('athlete') },
          { label: 'Профиль спортсмена' },
        ]}
        actions={
          data && (
            <Button
              variant="secondary"
              leftIcon={<IconPencil size={18} />}
              onClick={() => setEdit((state) => ({ open: true, key: state.key + 1 }))}
            >
              Изменить
            </Button>
          )
        }
      />

      {profile.isPending ? (
        <Skeleton className="h-48 rounded-lg" />
      ) : profile.isError ? (
        <ErrorState error={profile.error} onRetry={() => profile.refetch()} />
      ) : (
        <>
          <section className="flex flex-col gap-4 card rounded-lg p-5 sm:p-6">
            <Facts
              layout="row"
              items={[
                { label: 'Муниципалитет', value: profile.data.municipality?.name ?? 'Не указан' },
                {
                  label: 'Организация',
                  value: profile.data.no_organization
                    ? 'Без организации'
                    : (profile.data.organization?.name ?? 'Не указана'),
                },
                {
                  label: 'Дисциплины',
                  value: profile.data.disciplines.length
                    ? profile.data.disciplines.map((item) => item.name).join(', ')
                    : 'Не указаны',
                },
                { label: 'Год начала занятий', value: profile.data.start_year ?? 'Не указан' },
                { label: 'Этап подготовки', value: profile.data.training_stage?.title ?? 'Не указан' },
                profile.data.sex && { label: 'Пол', value: sexTitles[profile.data.sex] },
              ]}
            />
          </section>

          <section className="flex flex-col gap-4">
            <SectionHeader title="Тренеры" />
            {incoming.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/50 bg-primary-soft px-4 py-3"
              >
                <span className="text-ink">
                  {item.coach.name} просит вести вас по дисциплине «{item.discipline.name}»
                </span>
                <Button size="sm" onClick={() => setOpened({ open: true, link: item })}>
                  Ответить
                </Button>
              </div>
            ))}
            {links.isPending ? (
              <Skeleton className="h-20 rounded-lg" />
            ) : links.isError ? (
              <ErrorState error={links.error} onRetry={() => links.refetch()} />
            ) : !coaches.length ? (
              <p className="text-muted">Тренер присылает запрос, вы подтверждаете его здесь</p>
            ) : (
              <ul className="flex flex-col divide-y divide-line-soft overflow-hidden rounded-lg border border-line-soft">
                {coaches.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => setOpened({ open: true, link: item })}
                      className="flex w-full flex-wrap items-center justify-between gap-3 field-focus px-4 py-3 text-left transition-colors hover:bg-hover-tint sm:px-5"
                    >
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-ink">{item.coach.name}</span>
                        <span className="text-sm text-muted">{item.discipline.name}</span>
                      </span>
                      <StatusTag tone={linkTone[item.status]}>{item.status_title}</StatusTag>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="flex flex-col gap-4">
            <SectionHeader
              title="Антидопинг"
              action={
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<IconPlus size={18} />}
                  onClick={() => setAntidoping((state) => ({ open: true, key: state.key + 1 }))}
                >
                  Отметить курс
                </Button>
              }
            />
            {latest ? (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <StatusTag tone={latest.valid_until >= today ? 'active' : 'cancelled'}>
                  {latest.valid_until >= today
                    ? `Курс пройден, действует до ${day(latest.valid_until)}`
                    : `Срок курса истёк ${day(latest.valid_until)}`}
                </StatusTag>
                {(latest.certificate_url ?? latest.file_url) && (
                  <Button
                    variant="text"
                    size="sm"
                    href={latest.certificate_url ?? latest.file_url ?? undefined}
                    external
                  >
                    Сертификат
                  </Button>
                )}
              </div>
            ) : (
              <EmptyState
                title="Курс РУСАДА не отмечен"
                description="Пройдите онлайн-курс и приложите сертификат. Он действует год"
              />
            )}
            <ul className="flex flex-wrap gap-x-6 gap-y-2">
              {RUSADA.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 link-underline text-ink"
                  >
                    {item.label}
                    <IconExternal size={14} />
                  </a>
                </li>
              ))}
            </ul>
          </section>

          <SportProfileModal
            key={edit.key}
            open={edit.open}
            profile={profile.data}
            onClose={() => setEdit((state) => ({ ...state, open: false }))}
          />
        </>
      )}

      <AntidopingModal
        key={antidoping.key}
        open={antidoping.open}
        onClose={() => setAntidoping((state) => ({ ...state, open: false }))}
      />
      <LinkDetailsModal
        open={opened.open}
        link={opened.link}
        asAthlete
        onClose={() => setOpened((state) => ({ ...state, open: false }))}
      />
    </section>
  )
}
