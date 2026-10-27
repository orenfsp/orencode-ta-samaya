import { useState, type FormEvent } from 'react'
import { cn } from '@/shared/lib'
import {
  Button,
  Checkbox,
  Field,
  FileDrop,
  IconCheck,
  IconSearch,
  Input,
  PasswordInput,
  Radio,
  SearchSelect,
  Select,
  showToast,
  Switch,
  Textarea,
} from '@/shared/ui'
import { Row, Section } from './section'

// Правила пароля из ТЗ (строчная, заглавная, цифра) + длина от 8 — допущение из спецификации
const passwordRules = [
  { label: 'не короче 8 символов', test: (value: string) => value.length >= 8 },
  { label: 'строчная буква', test: (value: string) => /\p{Ll}/u.test(value) },
  { label: 'заглавная буква', test: (value: string) => /\p{Lu}/u.test(value) },
  { label: 'цифра', test: (value: string) => /\d/.test(value) },
]

// Демо-организации — вымышленные
const organizations = [
  { value: 'lyceum-1', label: 'Лицей № 1', description: 'г. Оренбург' },
  { value: 'osu', label: 'Оренбургский государственный университет', description: 'г. Оренбург' },
  { value: 'progress', label: 'СШ «Прогресс»', description: 'г. Орск' },
  { value: 'korolev', label: 'Клуб программирования «Королёв»', description: 'г. Новотроицк' },
  { value: 'none', label: 'Без организации' },
]

const municipalities = [
  { value: 'orenburg', label: 'г. Оренбург' },
  { value: 'orsk', label: 'г. Орск' },
  { value: 'novotroitsk', label: 'г. Новотроицк' },
  { value: 'buzuluk', label: 'г. Бузулук' },
]

export function FormsDemo() {
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [pending, setPending] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [organization, setOrganization] = useState<string | null>(null)
  const [note, setNote] = useState('')

  const passwordOk = passwordRules.every((rule) => rule.test(password))
  const errors = {
    login: submitted && !login.trim() ? 'Введите логин' : undefined,
    password: submitted && !passwordOk ? 'Пароль не подходит под правила' : undefined,
    repeat: submitted && repeat !== password ? 'Пароли не совпадают' : undefined,
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    setSubmitted(true)
    if (!login.trim() || !passwordOk || repeat !== password) return
    setPending(true)
    setTimeout(() => {
      setPending(false)
      showToast('Аккаунт создан', { tone: 'success', description: 'Это демо: на сервер ничего не ушло' })
    }, 1200)
  }

  return (
    <Section
      id="forms"
      title="Формы"
      description="Подпись сверху, высота 44px, ошибка — обводкой и текстом под полем. Ошибка появляется плавно, форма не дёргается."
    >
      <div className="grid gap-10 lg:grid-cols-2">
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
          <Field label="Логин" required error={errors.login}>
            <Input value={login} onChange={(event) => setLogin(event.target.value)} autoComplete="username" />
          </Field>
          <Field
            label="Пароль"
            required
            error={errors.password}
            labelEnd={
              <Button variant="text" size="sm" onClick={() => showToast('Ссылка для сброса придёт на почту')}>
                Забыли пароль?
              </Button>
            }
          >
            <PasswordInput
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
            />
          </Field>
          <ul className="-mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5">
            {passwordRules.map((rule) => {
              const ok = rule.test(password)
              return (
                <li
                  key={rule.label}
                  className={cn(
                    'flex items-center gap-2 text-sm transition-colors duration-220',
                    ok ? 'text-ink' : 'text-muted',
                  )}
                >
                  <span
                    className={cn(
                      'grid size-4 place-items-center rounded-full transition-[background-color,scale] duration-260 ease-spring',
                      ok ? 'scale-100 bg-primary text-white' : 'scale-90 bg-surface-2 text-transparent',
                    )}
                  >
                    <IconCheck size={11} strokeWidth={3} />
                  </span>
                  {rule.label}
                </li>
              )
            })}
          </ul>
          <Field label="Повторите пароль" required error={errors.repeat}>
            <PasswordInput
              value={repeat}
              onChange={(event) => setRepeat(event.target.value)}
              autoComplete="new-password"
            />
          </Field>
          <Checkbox
            label="Согласен на обработку персональных данных"
            description="Версия текста согласия сохраняется вместе с отметкой"
          />
          <Button type="submit" loading={pending} size="lg" className="self-start">
            Зарегистрироваться
          </Button>
        </form>

        <div className="flex flex-col gap-5">
          <Field label="Поиск" hint="Иконка слева — для поиска и фильтров">
            <Input leftIcon={<IconSearch size={18} />} placeholder="ФИО спортсмена" />
          </Field>
          <Field label="Организация" hint="Поиск по названию и городу, «ё» не мешает: попробуйте «королев»">
            <SearchSelect value={organization} onChange={setOrganization} options={organizations} />
          </Field>
          <Field label="Муниципалитет">
            <Select placeholder="Выберите муниципалитет" options={municipalities} defaultValue="" />
          </Field>
          <Field label="Заметка" hint="Растёт по содержимому, счётчик — только при лимите">
            <Textarea
              autoGrow
              minRows={2}
              maxLength={200}
              counter
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Комментарий к заявке"
            />
          </Field>
          <Field label="Недоступно">
            <Input disabled value="Поле заблокировано" readOnly />
          </Field>
          <FileDrop
            label="Согласие родителя (PDF)"
            hint="PDF до 10 МБ: скачайте шаблон, подпишите и загрузите скан"
            accept="application/pdf,.pdf"
            value={file}
            onChange={setFile}
          />
        </div>
      </div>

      <div className="mt-10 grid gap-8 border-t border-line-soft pt-8 sm:grid-cols-3">
        <Row label="Чекбоксы">
          <div className="flex flex-col gap-3">
            <Checkbox label="Онлайн" defaultChecked />
            <Checkbox label="Оффлайн" />
            <Checkbox label="Недоступно" disabled />
          </div>
        </Row>
        <Row label="Радио">
          <div className="flex flex-col gap-3">
            <Radio name="format" label="Очно" defaultChecked />
            <Radio name="format" label="Онлайн" />
            <Radio name="format" label="Смешанный" description="Разработка онлайн, защита очно" />
          </div>
        </Row>
        <Row label="Переключатели">
          <div className="flex flex-col gap-3">
            <Switch label="Уведомления на почту" defaultChecked />
            <Switch label="Публичная страница" />
            <Switch label="Недоступно" disabled />
          </div>
        </Row>
      </div>
    </Section>
  )
}
