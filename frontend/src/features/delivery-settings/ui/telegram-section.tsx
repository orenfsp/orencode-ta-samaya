import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { notificationApi, notificationKeys, useTelegramStatus } from '@/entities/notification'
import { formatDateLong } from '@/shared/lib'
import {
  Button,
  ConfirmModal,
  ErrorState,
  FormAlert,
  IconExternal,
  IconSend,
  Skeleton,
  showToast,
} from '@/shared/ui'

/**
 * Привязка Telegram: кнопка выдаёт одноразовую ссылку на бота, человек жмёт «Запустить» в Telegram,
 * страница опрашивает статус и сама показывает привязку.
 */
export function TelegramSection() {
  const client = useQueryClient()
  const [link, setLink] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const status = useTelegramStatus(Boolean(link))
  const refresh = () => client.invalidateQueries({ queryKey: notificationKeys.all })
  const create = useMutation({
    mutationFn: notificationApi.linkTelegram,
    onSuccess: (data) => setLink(data.url),
    onError: (error) =>
      showToast('Не удалось получить ссылку', { tone: 'danger', description: error.message }),
  })
  const unlink = useMutation({
    mutationFn: notificationApi.unlinkTelegram,
    onSuccess: () => {
      setLink(null)
      showToast('Telegram отвязан', { tone: 'success' })
      void refresh()
    },
  })

  if (status.isPending) return <Skeleton className="h-28 rounded-lg" />
  if (status.isError) return <ErrorState error={status.error} onRetry={() => void status.refetch()} />
  const data = status.data
  const bot = `https://t.me/${data.bot}`

  if (!data.available)
    return (
      <FormAlert tone="info">
        Бот не подключён на этом сервере: не задан токен FSP_TELEGRAM_BOT_TOKEN.
      </FormAlert>
    )

  if (data.linked)
    return (
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2 text-body">
          <IconSend size={18} className="shrink-0 text-primary-text" />
          <span>
            Привязан {data.username ? <span className="font-mono">@{data.username}</span> : 'аккаунт'}
            {data.linked_at && <span className="text-muted"> с {formatDateLong(data.linked_at)}</span>}
          </span>
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" href={bot} external rightIcon={<IconExternal size={16} />}>
            Открыть бота
          </Button>
          <Button variant="ghost" onClick={() => setConfirmOpen(true)}>
            Отвязать
          </Button>
        </div>
        <ConfirmModal
          open={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          onConfirm={() => unlink.mutateAsync().then(() => setConfirmOpen(false))}
          title="Отвязать Telegram?"
          description="Уведомления перестанут приходить в бота. Привязать снова можно в любой момент."
          confirmLabel="Отвязать"
          tone="danger"
        />
      </div>
    )

  return (
    <div className="flex flex-col gap-4">
      <p className="text-body text-muted">
        Бот <span className="font-mono text-ink">@{data.bot}</span> присылает уведомления кабинета, показывает
        ваши заявки и ближайшие соревнования, подтверждает участие кнопкой.
      </p>
      {link ? (
        <div className="flex flex-col gap-3">
          <FormAlert tone="info">
            Откройте бота и нажмите «Запустить». Страница сама увидит привязку. Ссылка действует 10 минут.
          </FormAlert>
          <div className="flex flex-wrap gap-2">
            <Button href={link} external rightIcon={<IconExternal size={16} />}>
              Открыть Telegram
            </Button>
            <Button variant="ghost" onClick={() => setLink(null)}>
              Отмена
            </Button>
          </div>
        </div>
      ) : (
        <Button
          className="self-start"
          leftIcon={<IconSend size={18} />}
          loading={create.isPending}
          onClick={() => create.mutate()}
        >
          Привязать Telegram
        </Button>
      )}
    </div>
  )
}
