import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useDictionaryOptions } from '@/entities/dictionary'
import { useOrganizationOptions } from '@/entities/organization'
import {
  sexTitles,
  sportProfileApi,
  sportProfileKeys,
  stageTitles,
  type Sex,
  type SportProfile,
  type TrainingStage,
} from '@/entities/sport-profile'
import { ApiError } from '@/shared/api'
import {
  Button,
  Checkbox,
  Field,
  FormAlert,
  Input,
  Modal,
  SearchSelect,
  Select,
  showToast,
} from '@/shared/ui'

const NONE = 'none'

/** Спортивный профиль: муниципалитет, организация или «без организации», дисциплины, год начала, этап, пол */
export function SportProfileModal({
  open,
  profile,
  onClose,
}: {
  open: boolean
  profile: SportProfile
  onClose: () => void
}) {
  const client = useQueryClient()
  const municipalities = useDictionaryOptions('municipalities')
  const disciplines = useDictionaryOptions('disciplines')
  const organizations = useOrganizationOptions()
  const [municipality, setMunicipality] = useState(
    profile.municipality ? String(profile.municipality.id) : null,
  )
  const [organization, setOrganization] = useState<string | null>(
    profile.no_organization ? NONE : profile.organization ? String(profile.organization.id) : null,
  )
  const [picked, setPicked] = useState<number[]>(profile.disciplines.map((item) => item.id))
  const [startYear, setStartYear] = useState(profile.start_year ? String(profile.start_year) : '')
  const [stage, setStage] = useState<string>(profile.training_stage?.value ?? '')
  const [sex, setSex] = useState<string>(profile.sex ?? '')

  const save = useMutation({
    mutationFn: () =>
      sportProfileApi.save({
        municipality_id: municipality ? Number(municipality) : null,
        organization_id: organization && organization !== NONE ? Number(organization) : null,
        no_organization: organization === NONE,
        discipline_ids: picked,
        start_year: startYear ? Number(startYear) : null,
        training_stage: (stage || null) as TrainingStage | null,
        sex: (sex || null) as Sex | null,
      }),
    onSuccess: (data) => {
      client.setQueryData(sportProfileKeys.profile, data)
      showToast('Профиль сохранён', { tone: 'success' })
      onClose()
    },
  })
  const error = save.error instanceof ApiError ? save.error : null
  const toggle = (id: number) =>
    setPicked((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    )

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    save.mutate()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Спортивный профиль"
      description="По этим данным федерация ведёт реестр и считает численность занимающихся"
      onSubmit={onSubmit}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" loading={save.isPending}>
            Сохранить
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Муниципалитет" error={error?.field('municipality_id')}>
            <SearchSelect
              value={municipality}
              onChange={setMunicipality}
              placeholder="Город или район"
              options={(municipalities.data ?? []).map((item) => ({
                value: String(item.id),
                label: item.name,
              }))}
            />
          </Field>
          <Field
            label="Организация"
            hint="Школа, вуз, спортивная школа или клуб"
            error={error?.field('organization_id')}
          >
            <SearchSelect
              value={organization}
              onChange={setOrganization}
              placeholder="Название"
              options={[
                { value: NONE, label: 'Без организации' },
                ...(organizations.data?.items ?? []).map((item) => ({
                  value: String(item.id),
                  label: item.name,
                  description: item.municipality?.name,
                })),
              ]}
            />
          </Field>
          <Field label="Год начала занятий" error={error?.field('start_year')}>
            <Input
              inputMode="numeric"
              maxLength={4}
              className="font-mono tabular-nums"
              value={startYear}
              onChange={(event) => setStartYear(event.target.value.replace(/\D/g, ''))}
            />
          </Field>
          <Field label="Пол" hint="Нужен для нормативов ФССП">
            <Select
              value={sex}
              onChange={(event) => setSex(event.target.value)}
              placeholder="Не указан"
              options={Object.entries(sexTitles).map(([value, label]) => ({ value, label }))}
            />
          </Field>
          <Field label="Этап спортивной подготовки" className="sm:col-span-2">
            <Select
              value={stage}
              onChange={(event) => setStage(event.target.value)}
              placeholder="Не указан"
              options={Object.entries(stageTitles).map(([value, label]) => ({ value, label }))}
            />
          </Field>
        </div>
        <Field label="Дисциплины" error={error?.field('discipline_ids')}>
          <div className="grid gap-1 sm:grid-cols-2">
            {(disciplines.data ?? []).map((item) => (
              <Checkbox
                key={item.id}
                label={item.name}
                checked={picked.includes(item.id)}
                onChange={() => toggle(item.id)}
              />
            ))}
          </div>
        </Field>
        {save.isError && !Object.keys(error?.fields ?? {}).length && (
          <FormAlert>{save.error.message}</FormAlert>
        )}
      </div>
    </Modal>
  )
}
