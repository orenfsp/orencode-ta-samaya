import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useDictionaryOptions } from '@/entities/dictionary'
import { organizationApi, organizationKeys, type Organization } from '@/entities/organization'
import { ApiError } from '@/shared/api'
import {
  Button,
  DateInput,
  Field,
  FormAlert,
  Input,
  Modal,
  SearchSelect,
  Select,
  Switch,
  showToast,
} from '@/shared/ui'

/** Карточка организации для федерации: название, тип, муниципалитет, реквизиты лицензии */
export function OrganizationFormModal({
  open,
  item,
  onClose,
}: {
  open: boolean
  item: Organization | null
  onClose: () => void
}) {
  const client = useQueryClient()
  const types = useDictionaryOptions('organization_types')
  const municipalities = useDictionaryOptions('municipalities')
  const [name, setName] = useState(item?.name ?? '')
  const [shortName, setShortName] = useState(item?.short_name ?? '')
  const [type, setType] = useState(item ? String(item.organization_type.id) : '')
  const [municipality, setMunicipality] = useState(item?.municipality ? String(item.municipality.id) : null)
  const [inn, setInn] = useState(item?.inn ?? '')
  const [address, setAddress] = useState(item?.address ?? '')
  const [website, setWebsite] = useState(item?.website ?? '')
  const [license, setLicense] = useState(item?.license_number ?? '')
  const [licenseDate, setLicenseDate] = useState(item?.license_date ?? '')
  const [active, setActive] = useState(item?.is_active ?? true)

  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: name.trim(),
        short_name: shortName.trim() || null,
        organization_type_id: type ? Number(type) : undefined,
        municipality_id: municipality ? Number(municipality) : null,
        inn: inn.trim() || null,
        address: address.trim() || null,
        website: website.trim() || null,
        license_number: license.trim() || null,
        license_date: licenseDate || null,
        is_active: active,
      }
      return item ? organizationApi.update(item.id, body) : organizationApi.create(body)
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: organizationKeys.all })
      showToast(item ? 'Организация сохранена' : 'Организация добавлена', { tone: 'success' })
      onClose()
    },
  })
  const error = save.error instanceof ApiError ? save.error : null

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    save.mutate()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={item ? 'Организация' : 'Новая организация'}
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
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Полное название" required error={error?.field('name')} className="sm:col-span-2">
          <Input value={name} maxLength={300} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field label="Короткое название">
          <Input value={shortName} maxLength={120} onChange={(event) => setShortName(event.target.value)} />
        </Field>
        <Field label="Тип" required error={error?.field('organization_type_id')}>
          <Select
            value={type}
            onChange={(event) => setType(event.target.value)}
            placeholder="Выберите"
            options={(types.data ?? []).map((value) => ({ value: String(value.id), label: value.name }))}
          />
        </Field>
        <Field label="Муниципалитет" error={error?.field('municipality_id')}>
          <SearchSelect
            value={municipality}
            onChange={setMunicipality}
            options={(municipalities.data ?? []).map((value) => ({
              value: String(value.id),
              label: value.name,
            }))}
          />
        </Field>
        <Field label="ИНН" error={error?.field('inn')}>
          <Input
            inputMode="numeric"
            maxLength={12}
            className="font-mono tabular-nums"
            value={inn}
            onChange={(event) => setInn(event.target.value.replace(/\D/g, ''))}
          />
        </Field>
        <Field label="Адрес" className="sm:col-span-2">
          <Input value={address} maxLength={300} onChange={(event) => setAddress(event.target.value)} />
        </Field>
        <Field label="Сайт">
          <Input
            type="url"
            placeholder="https://"
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
          />
        </Field>
        <Field label="Номер лицензии">
          <Input value={license} maxLength={100} onChange={(event) => setLicense(event.target.value)} />
        </Field>
        <Field label="Дата лицензии">
          <DateInput value={licenseDate} onChange={setLicenseDate} />
        </Field>
        <div className="flex items-end pb-2">
          <Switch label="Действует" checked={active} onChange={(event) => setActive(event.target.checked)} />
        </div>
        {save.isError && !Object.keys(error?.fields ?? {}).length && (
          <FormAlert className="sm:col-span-2">{save.error.message}</FormAlert>
        )}
      </div>
    </Modal>
  )
}
