import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useDictionaryOptions } from '@/entities/dictionary'
import { useRegistryCoaches } from '@/entities/registry'
import {
  stageOptions,
  trainingApi,
  trainingKeys,
  useOrganizationCard,
  type TrainingStage,
} from '@/entities/training'
import { formatDate } from '@/shared/lib'
import {
  Button,
  EmptyState,
  ErrorState,
  Facts,
  Field,
  FormAlert,
  IconButton,
  IconClose,
  IconPencil,
  Input,
  Modal,
  SearchSelect,
  Select,
  Skeleton,
  Tabs,
  showToast,
} from '@/shared/ui'

type Tab = 'programs' | 'coaches' | 'groups'
const day = (value: string) => formatDate(`${value}T12:00:00Z`)

/** Карточка организации для федерации: реквизиты, программы подготовки по этапам, тренеры-преподаватели, группы */
export function OrganizationCardModal({
  open,
  organizationId,
  onEdit,
  onClose,
}: {
  open: boolean
  organizationId: number | null
  onEdit: () => void
  onClose: () => void
}) {
  const client = useQueryClient()
  const card = useOrganizationCard(open ? organizationId : null, true)
  const disciplines = useDictionaryOptions('disciplines')
  const coaches = useRegistryCoaches({ limit: 200 })
  const [tab, setTab] = useState<Tab>('programs')
  const [discipline, setDiscipline] = useState('')
  const [stage, setStage] = useState<TrainingStage>('initial')
  const [coach, setCoach] = useState<string | null>(null)
  const [position, setPosition] = useState('Тренер-преподаватель')
  const id = organizationId ?? 0

  const change = useMutation({
    mutationFn: (action: () => Promise<unknown>) => action(),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: trainingKeys.all })
      showToast('Карточка организации обновлена', { tone: 'success' })
    },
  })
  const data = card.data

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={data?.short_name ?? data?.name ?? 'Организация'}
      description={data?.short_name ? data.name : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Закрыть
          </Button>
          <Button variant="secondary" leftIcon={<IconPencil size={18} />} onClick={onEdit} disabled={!data}>
            Изменить реквизиты
          </Button>
        </>
      }
    >
      {card.isPending ? (
        <Skeleton className="h-64 rounded-lg" />
      ) : card.isError ? (
        <ErrorState error={card.error} onRetry={() => card.refetch()} />
      ) : (
        <div className="flex flex-col gap-6">
          <Facts
            items={[
              { label: 'Тип', value: card.data.organization_type.name },
              card.data.municipality && { label: 'Муниципалитет', value: card.data.municipality.name },
              Boolean(card.data.inn) && {
                label: 'ИНН',
                value: <span className="font-mono tabular-nums">{card.data.inn}</span>,
              },
              {
                label: 'Лицензия',
                value: card.data.license_number
                  ? `${card.data.license_number}${card.data.license_date ? ` от ${day(card.data.license_date)}` : ''}`
                  : 'Не указана',
              },
              { label: 'В группах', value: `${card.data.athletes} чел.` },
            ]}
          />
          <Tabs
            variant="underline"
            value={tab}
            onChange={setTab}
            items={[
              { value: 'programs', label: `Программы · ${card.data.programs.length}` },
              { value: 'coaches', label: `Тренеры · ${card.data.coaches.length}` },
              { value: 'groups', label: `Группы · ${card.data.groups.length}` },
            ]}
          />
          {tab === 'programs' && (
            <div className="flex flex-col gap-4">
              <div className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                <Field label="Дисциплина">
                  <Select
                    value={discipline}
                    onChange={(event) => setDiscipline(event.target.value)}
                    placeholder="Выберите"
                    options={(disciplines.data ?? []).map((item) => ({
                      value: String(item.id),
                      label: item.name,
                    }))}
                  />
                </Field>
                <Field label="Этап">
                  <Select
                    value={stage}
                    onChange={(event) => setStage(event.target.value as TrainingStage)}
                    options={stageOptions.map((item) => ({ value: item.value, label: item.label }))}
                  />
                </Field>
                <Button
                  disabled={!discipline}
                  loading={change.isPending}
                  onClick={() =>
                    change.mutate(() =>
                      trainingApi.addProgram(id, { discipline_id: Number(discipline), stage }),
                    )
                  }
                >
                  Добавить
                </Button>
              </div>
              {card.data.programs.length ? (
                <ul className="flex flex-col divide-y divide-line-soft rounded-lg border border-line-soft">
                  {card.data.programs.map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <span className="flex min-w-0 flex-col">
                        <span className="text-ink">{item.discipline.name}</span>
                        <span className="text-sm text-muted">
                          {item.stage.title} · с {day(item.valid_from)}
                        </span>
                      </span>
                      <IconButton
                        aria-label="Закрыть программу"
                        icon={<IconClose size={18} />}
                        onClick={() => change.mutate(() => trainingApi.closeProgram(id, item.id))}
                      />
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  title="Программ нет"
                  description="Добавьте дисциплину и этап, по которым ведётся подготовка"
                />
              )}
            </div>
          )}
          {tab === 'coaches' && (
            <div className="flex flex-col gap-4">
              <div className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                <Field label="Тренер">
                  <SearchSelect
                    value={coach}
                    onChange={setCoach}
                    options={(coaches.data?.items ?? []).map((item) => ({
                      value: item.id,
                      label: item.name,
                    }))}
                  />
                </Field>
                <Field label="Должность">
                  <Input
                    value={position}
                    maxLength={120}
                    onChange={(event) => setPosition(event.target.value)}
                  />
                </Field>
                <Button
                  disabled={!coach || !position.trim()}
                  loading={change.isPending}
                  onClick={() =>
                    change.mutate(() =>
                      trainingApi.addCoach(id, { coach_id: coach!, position: position.trim() }),
                    )
                  }
                >
                  Добавить
                </Button>
              </div>
              {card.data.coaches.length ? (
                <ul className="flex flex-col divide-y divide-line-soft rounded-lg border border-line-soft">
                  {card.data.coaches.map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <span className="flex min-w-0 flex-col">
                        <span className="text-ink">{item.coach.name}</span>
                        <span className="text-sm text-muted">
                          {item.position} · с {day(item.valid_from)}
                        </span>
                      </span>
                      <IconButton
                        aria-label="Завершить работу тренера"
                        icon={<IconClose size={18} />}
                        onClick={() => change.mutate(() => trainingApi.closeCoach(id, item.id))}
                      />
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title="Тренеров нет" description="Добавьте тренеров-преподавателей организации" />
              )}
            </div>
          )}
          {tab === 'groups' &&
            (card.data.groups.length ? (
              <ul className="flex flex-col divide-y divide-line-soft rounded-lg border border-line-soft">
                {card.data.groups.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <span className="flex min-w-0 flex-col">
                      <span className="text-ink">{item.name}</span>
                      <span className="text-sm text-muted">
                        {item.discipline.name} · {item.stage.title} · {item.coach.name}
                      </span>
                    </span>
                    <span className="font-mono text-sm text-muted tabular-nums">{item.size} чел.</span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                title="Групп нет"
                description="Группы открывают тренеры организации в разделе «Группы»"
              />
            ))}
          {change.isError && <FormAlert>{change.error.message}</FormAlert>}
        </div>
      )}
    </Modal>
  )
}
