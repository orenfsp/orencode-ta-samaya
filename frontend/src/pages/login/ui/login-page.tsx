import { useNavigate, useSearchParams } from 'react-router'
import { LoginForm } from '@/features/auth-login'
import { routes } from '@/shared/config'

/** Возврат туда, откуда отправили на вход. Только внутренние пути — чтобы ссылку нельзя было увести на чужой сайт */
function safeNext(next: string | null) {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : routes.cabinet
}

export function LoginPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  return <LoginForm onSuccess={() => navigate(safeNext(params.get('next')), { replace: true })} />
}
