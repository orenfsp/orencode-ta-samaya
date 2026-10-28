import type { DocumentForm, DocumentGroup, DocumentKind } from '@/entities/document'
import { orenburgDay } from '@/shared/lib'

export const kindOrder: DocumentKind[] = [
  'certificate',
  'diploma',
  'gramota',
  'thanks',
  'judge_thanks',
  'reference',
  'judge_panel',
]

export const kindLabels: Record<DocumentKind, string> = {
  certificate: 'Сертификаты участников',
  diploma: 'Дипломы призёров',
  gramota: 'Грамоты',
  thanks: 'Благодарности тренерам',
  judge_thanks: 'Благодарности судьям',
  reference: 'Справки об участии',
  judge_panel: 'Справка о составе судейской коллегии',
}

/** Кому достанется документ: подсказка под выбором вида */
export const kindRecipients: Record<DocumentKind, string> = {
  certificate: 'Всем участникам одобренных заявок, кроме дисквалифицированных',
  diploma: 'Участникам с местами до указанного включительно, каждому члену команды',
  gramota: 'Всем участникам или призёрам — на выбор',
  thanks:
    'Тренерам, подавшим заявки, если их спортсмены получили место. Подопечные с местами перечисляются сами',
  judge_thanks: 'Судьям коллегии: всем или выбранным. Должность подставляется сама',
  reference:
    'Каждому спортсмену, тренерам, подавшим заявки, и судьям коллегии. Текст собирается из заявки, мест и должности',
  judge_panel:
    'Одна справка на соревнование: судьи коллегии, должности и категории на дату начала. Получатель — организатор',
}

type Content = Pick<DocumentForm, 'title' | 'lead' | 'text' | 'recipients' | 'places_to'>

export const presets: Record<DocumentKind, Content> = {
  certificate: {
    title: 'Сертификат',
    lead: 'подтверждает, что',
    text: 'принял(а) участие в соревновании',
    recipients: 'participants',
    places_to: 3,
  },
  diploma: {
    title: 'Диплом',
    lead: 'награждается',
    text: 'за высокие результаты',
    recipients: 'winners',
    places_to: 3,
  },
  gramota: { title: 'Грамота', lead: 'награждается', text: '', recipients: 'winners', places_to: 1 },
  thanks: {
    title: 'Благодарность',
    lead: 'выражается',
    text: 'за подготовку спортсменов',
    recipients: 'participants',
    places_to: 3,
  },
  judge_thanks: {
    title: 'Благодарность',
    lead: 'выражается',
    text: 'за объективное судейство',
    recipients: 'participants',
    places_to: 3,
  },
  judge_panel: {
    title: 'о составе судейской коллегии',
    lead: '',
    text: 'Справка выдана для предъявления по месту требования.',
    recipients: 'participants',
    places_to: 3,
  },
  reference: {
    title: 'об участии в соревновании',
    lead: '',
    text: 'Справка выдана для предъявления по месту требования.',
    recipients: 'participants',
    places_to: 3,
  },
}

const SIGNER_KEY = 'fsp.documents.signer'

/** Подписант повторяется из раза в раз: помним его в браузере */
function savedSigner(): Pick<DocumentForm, 'signer_position' | 'signer_name'> {
  try {
    const value = JSON.parse(localStorage.getItem(SIGNER_KEY) ?? '{}') as Partial<DocumentForm>
    return { signer_position: value.signer_position ?? '', signer_name: value.signer_name ?? '' }
  } catch {
    return { signer_position: '', signer_name: '' }
  }
}

export function saveSigner(form: DocumentForm) {
  localStorage.setItem(
    SIGNER_KEY,
    JSON.stringify({ signer_position: form.signer_position, signer_name: form.signer_name }),
  )
}

/** Новый выпуск — из заготовки, перевыпуск — из того, что уже выдано */
export function formFor(kind: DocumentKind, group?: DocumentGroup): DocumentForm {
  if (group)
    return {
      title: group.form.title,
      lead: group.form.lead ?? '',
      text: group.form.text ?? '',
      recipients: group.form.recipients,
      places_to: group.form.places_to,
      signer_position: group.form.signer_position ?? '',
      signer_name: group.form.signer_name ?? '',
      issued_on: orenburgDay(new Date()),
    }
  return { ...presets[kind], ...savedSigner(), issued_on: orenburgDay(new Date()) }
}
