import { useNavigate, useSearchParams } from 'react-router'
import { ForgotPasswordForm, ResetPasswordForm } from '@/features/password-reset'
import { routes } from '@/shared/config'
import { Button, FormAlert, showToast } from '@/shared/ui'

export function ForgotPasswordPage() {
  return <ForgotPasswordForm />
}

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = params.get('token')

  if (!token) {
    return (
      <div className="flex flex-col gap-5">
        <h1 className="text-h2 font-medium">Нет ссылки для сброса</h1>
        <FormAlert>Откройте ссылку из письма целиком или запросите новую.</FormAlert>
        <Button to={routes.forgotPassword} size="lg" fullWidth>
          Запросить ссылку
        </Button>
      </div>
    )
  }

  return (
    <ResetPasswordForm
      token={token}
      onSuccess={() => {
        showToast('Пароль обновлён', { tone: 'success', description: 'Войдите с новым паролем' })
        navigate(routes.login, { replace: true })
      }}
    />
  )
}
