import { Navigate, useNavigate } from 'react-router'
import { ForgotPasswordForm } from '@/features/password-reset'
import { routes } from '@/shared/config'
import { showToast } from '@/shared/ui'

export function ForgotPasswordPage() {
  const navigate = useNavigate()
  return (
    <ForgotPasswordForm
      onDone={() => {
        showToast('Пароль обновлён', { tone: 'success', description: 'Войдите с новым паролем' })
        navigate(routes.login, { replace: true })
      }}
    />
  )
}

/** Старые ссылки из писем со ссылкой: теперь восстановление идёт по коду */
export function ResetPasswordPage() {
  return <Navigate to={routes.forgotPassword} replace />
}
