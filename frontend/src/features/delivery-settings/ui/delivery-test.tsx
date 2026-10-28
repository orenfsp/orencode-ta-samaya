import { useMutation, useQueryClient } from '@tanstack/react-query'
import { notificationApi, notificationKeys, useTelegramStatus } from '@/entities/notification'
import { Button, IconExternal, IconSend, showToast } from '@/shared/ui'

/** Проверка доставки: одно тестовое уведомление во все подключённые каналы сразу */
export function DeliveryTest({ email, emailVerified }: { email: string; emailVerified: boolean }) {
  const client = useQueryClient()
  const telegram = useTelegramStatus()
  const test = useMutation({
    mutationFn: notificationApi.test,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: notificationKeys.all })
      showToast('Тестовое уведомление отправлено', { tone: 'success' })
    },
    onError: (error) => showToast('Не отправилось', { tone: 'danger', description: error.message }),
  })
  const data = telegram.data
  const channels = [
    'кабинет',
    emailVerified ? `почта ${email}` : null,
    data?.linked ? `Telegram${data.username ? ` @${data.username}` : ''}` : null,
  ].filter(Boolean)

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-body text-muted">
        Куда придёт: <span className="text-ink">{channels.join(', ')}</span>
      </p>
      <div className="flex flex-wrap gap-2">
        <Button leftIcon={<IconSend size={18} />} loading={test.isPending} onClick={() => test.mutate()}>
          Отправить тестовое
        </Button>
        {data?.mailpit_url && (
          <Button variant="secondary" href={data.mailpit_url} external rightIcon={<IconExternal size={16} />}>
            Почтовый ящик
          </Button>
        )}
      </div>
    </div>
  )
}
