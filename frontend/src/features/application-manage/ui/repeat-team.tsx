import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  activeMembers,
  applicationApi,
  applicationKeys,
  personName,
  useMyApplications,
  type ApplicationRole,
} from '@/entities/application'
import type { CompetitionSummary } from '@/entities/competition'
import { ApiError } from '@/shared/api'
import { Button, FormAlert, showToast } from '@/shared/ui'

/**
 * Команда, которая уже выступала вместе: одна кнопка вместо сборки заново.
 * Возраст, согласия и размер команды сервер проверяет как у новой заявки и называет, кто не проходит.
 */
export function RepeatTeam({
  contest,
  role,
  userId,
  onDone,
}: {
  contest: CompetitionSummary
  role: ApplicationRole
  userId: string
  onDone: () => void
}) {
  const client = useQueryClient()
  const mine = useMyApplications(role)
  const repeat = useMutation({
    mutationFn: (sourceId: number) => applicationApi.repeat(contest.id, sourceId),
    onSuccess: (created) => {
      void client.invalidateQueries({ queryKey: applicationKeys.all })
      showToast(`Заявка «${created.team_name ?? 'команда'}» создана`, {
        tone: 'success',
        description: 'Участники получат приглашения',
      })
      onDone()
    },
  })
  const seen = new Set<string>()
  const teams = (mine.data ?? []).filter((item) => {
    if (!item.team_name || item.creator.id !== userId || item.contest.id === contest.id) return false
    const key = item.team_name.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  if (contest.participation_type !== 'team' || !teams.length) return null

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-line-soft p-4">
      <h4 className="font-medium">Тем же составом</h4>
      <ul className="flex flex-col gap-2">
        {teams.slice(0, 4).map((item) => (
          <li key={item.id} className="flex flex-wrap items-center justify-between gap-3">
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-ink">«{item.team_name}»</span>
              <span className="truncate text-sm text-muted">
                {activeMembers(item)
                  .map((member) => personName(member.user))
                  .join(', ')}
              </span>
            </span>
            <Button
              size="sm"
              variant="secondary"
              loading={repeat.isPending && repeat.variables === item.id}
              disabled={repeat.isPending}
              onClick={() => repeat.mutate(item.id)}
            >
              Подать
            </Button>
          </li>
        ))}
      </ul>
      {repeat.isError && (
        <FormAlert>
          {(repeat.error instanceof ApiError && Object.values(repeat.error.fields).flat().join('; ')) ||
            repeat.error.message}
        </FormAlert>
      )}
    </section>
  )
}
