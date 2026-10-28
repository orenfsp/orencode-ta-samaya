import { useState } from 'react'
import { RegisterWizard } from '@/features/auth-register'
import { EmailVerifyForm } from '@/features/email-verify'
import { hasCabinetAccess, roleLabels, type User } from '@/entities/session'
import { routes } from '@/shared/config'
import { Button, IconArrowRight, StatusTag } from '@/shared/ui'

function RegisterSuccess({ user }: { user: User }) {
  const anyAccess = user.roles.some(hasCabinetAccess)
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-h2 font-medium">Аккаунт создан</h1>
        <p className="text-body text-muted">
          {anyAccess
            ? 'Кабинет уже открыт.'
            : 'Кабинет откроется, когда федерация подтвердит роль. Об этом придёт уведомление.'}
        </p>
      </div>
      <ul className="flex flex-col gap-2">
        {user.roles.map((item, index) => (
          <li
            key={item.role}
            style={{ animationDelay: `${150 + index * 60}ms` }}
            className="flex animate-rise items-center justify-between gap-3 card px-4 py-3"
          >
            <span className="text-body text-ink">{roleLabels[item.role]}</span>
            {item.role === 'athlete' || (item.role === 'coach' && item.status === 'verified') ? (
              <StatusTag tone="active">Доступна сразу</StatusTag>
            ) : item.role === 'coach' ? (
              <StatusTag tone="active">Сразу · проверка по желанию</StatusTag>
            ) : (
              <StatusTag tone="draft">После проверки ФСП</StatusTag>
            )}
          </li>
        ))}
      </ul>
      <Button to={routes.cabinet} size="lg" fullWidth rightIcon={<IconArrowRight size={18} />}>
        Перейти в кабинет
      </Button>
    </div>
  )
}

/** Регистрация: анкета → код из письма (можно позже) → что открыто */
export function RegisterPage() {
  const [user, setUser] = useState<User | null>(null)
  const [verified, setVerified] = useState(false)
  if (!user) return <RegisterWizard onSuccess={setUser} />
  if (!verified)
    return (
      <EmailVerifyForm
        email={user.email}
        onDone={() => setVerified(true)}
        secondary={
          <Button variant="ghost" onClick={() => setVerified(true)}>
            Подтвердить позже
          </Button>
        }
      />
    )
  return <RegisterSuccess user={user} />
}
