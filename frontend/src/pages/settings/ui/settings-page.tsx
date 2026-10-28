import { useState, type ReactNode } from 'react'
import { useParams } from 'react-router'
import { useTelegramStatus } from '@/entities/notification'
import { useMe } from '@/entities/session'
import { CodeforcesForm, ProfileForm } from '@/features/account-profile'
import { ConsentSection } from '@/features/guardian-consent'
import { BotAdminsSection } from '@/features/bot-admins'
import { DeliveryTest, PreferencesTable, TelegramSection } from '@/features/delivery-settings'
import { EmailChangeModal, EmailVerifyStrip } from '@/features/email-verify'
import { routes } from '@/shared/config'
import { Button, PageHeader, Skeleton, StatusTag } from '@/shared/ui'
import { startTour } from '@/widgets/cabinet-shell'

function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-4" aria-label={title}>
      <div className="flex flex-col gap-1">
        <h2 className="text-h3 font-medium">{title}</h2>
        {description && <p className="text-body text-muted">{description}</p>}
      </div>
      {children}
    </section>
  )
}

/** Настройки кабинета: почта, Telegram, куда что присылать, проверка доставки; у федерации — администраторы бота */
export function SettingsPage() {
  const { role = '' } = useParams()
  const { data: me } = useMe()
  const telegram = useTelegramStatus()
  const [changeKey, setChangeKey] = useState(0)
  const [changeOpen, setChangeOpen] = useState(false)

  if (!me) return <Skeleton className="h-96 rounded-lg" />

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        crumbs={[
          { label: 'Главная', to: routes.home },
          { label: 'Кабинет', to: routes.cabinetRole(role) },
          { label: 'Настройки' },
        ]}
        title="Настройки"
      />

      <Section title="Профиль" description="ФИО и дата рождения — общие для всех ролей аккаунта">
        <ProfileForm key={me.id} me={me} />
        <CodeforcesForm me={me} />
      </Section>

      {role === 'athlete' && <ConsentSection />}

      <Section title="Почта">
        <div className="flex flex-col gap-4 card p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="text-body break-all text-ink">{me.email}</span>
            <StatusTag tone={me.email_verified ? 'active' : 'live'}>
              {me.email_verified ? 'подтверждена' : 'не подтверждена'}
            </StatusTag>
          </div>
          <Button
            variant="secondary"
            onClick={() => {
              setChangeKey((key) => key + 1)
              setChangeOpen(true)
            }}
          >
            Изменить почту
          </Button>
        </div>
        {!me.email_verified && <EmailVerifyStrip email={me.email} />}
      </Section>

      <Section title="Telegram">
        <div className="card p-5">
          <TelegramSection />
        </div>
      </Section>

      <Section title="Уведомления" description="Какие события присылать на почту и в Telegram">
        <PreferencesTable emailVerified={me.email_verified} telegramLinked={Boolean(telegram.data?.linked)} />
      </Section>

      <Section title="Проверка доставки">
        <div className="card p-5">
          <DeliveryTest email={me.email} emailVerified={me.email_verified} />
        </div>
      </Section>

      <Section title="Навигатор по кабинету">
        <div className="flex flex-col gap-4 card p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-body text-muted">Пошаговый показ разделов кабинета и что в них делать</p>
          <Button variant="secondary" onClick={startTour}>
            Пройти заново
          </Button>
        </div>
      </Section>

      {role === 'federation' && (
        <Section title="Администраторы бота" description="Кто и что может в «Панели федерации» Telegram-бота">
          <BotAdminsSection />
        </Section>
      )}

      <EmailChangeModal key={changeKey} open={changeOpen} onClose={() => setChangeOpen(false)} />
    </div>
  )
}
