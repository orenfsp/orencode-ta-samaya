import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  notificationApi,
  notificationKeys,
  usePreferences,
  type DeliveryChannel,
  type Preference,
} from '@/entities/notification'
import { ErrorState, Skeleton, Switch, Table, TBody, TD, TH, THead, TR, showToast } from '@/shared/ui'

/** Какие группы событий в какой канал. Кабинет получает всё всегда; безопасность выключить нельзя */
export function PreferencesTable({
  emailVerified,
  telegramLinked,
}: {
  emailVerified: boolean
  telegramLinked: boolean
}) {
  const client = useQueryClient()
  const preferences = usePreferences()
  const save = useMutation({
    mutationFn: notificationApi.savePreferences,
    onMutate: async ([change]) => {
      await client.cancelQueries({ queryKey: notificationKeys.preferences })
      const previous = client.getQueryData<{ items: Preference[] }>(notificationKeys.preferences)
      client.setQueryData<{ items: Preference[] }>(notificationKeys.preferences, (data) =>
        data
          ? {
              items: data.items.map((item) =>
                item.group === change.group ? { ...item, [change.channel]: change.enabled } : item,
              ),
            }
          : data,
      )
      return previous
    },
    onError: (error, _change, previous) => {
      client.setQueryData(notificationKeys.preferences, previous)
      showToast('Не удалось сохранить', { tone: 'danger', description: error.message })
    },
    onSuccess: (data) => client.setQueryData(notificationKeys.preferences, data),
  })

  if (preferences.isPending) return <Skeleton className="h-64 rounded-lg" />
  if (preferences.isError)
    return <ErrorState error={preferences.error} onRetry={() => void preferences.refetch()} />

  const toggle = (item: Preference, channel: DeliveryChannel) =>
    save.mutate([{ group: item.group, channel, enabled: !item[channel] }])

  return (
    <div className="flex flex-col gap-2">
      <Table>
        <THead>
          <TR>
            <TH>События</TH>
            <TH className="w-28">Почта</TH>
            <TH className="w-28">Telegram</TH>
          </TR>
        </THead>
        <TBody>
          {preferences.data.map((item) => (
            <TR key={item.group}>
              <TD>
                <span className="flex flex-col gap-0.5">
                  <span>{item.label}</span>
                  <span className="text-sm text-muted">{item.description}</span>
                </span>
              </TD>
              {(['email', 'telegram'] as const).map((channel) => (
                <TD key={channel}>
                  {item.locked ? (
                    <span className="font-mono text-sm text-muted">Всегда</span>
                  ) : (
                    <Switch
                      aria-label={`${item.label}: ${channel === 'email' ? 'почта' : 'Telegram'}`}
                      checked={item[channel]}
                      onChange={() => toggle(item, channel)}
                    />
                  )}
                </TD>
              ))}
            </TR>
          ))}
        </TBody>
      </Table>
      <p className="text-sm text-muted">
        В кабинет приходит всё.
        {!emailVerified && ' Письма начнут приходить после подтверждения почты.'}
        {!telegramLinked && ' Для Telegram сначала привяжите аккаунт.'}
      </p>
    </div>
  )
}
