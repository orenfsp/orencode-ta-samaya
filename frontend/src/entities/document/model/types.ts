import type { CompetitionScope } from '@/entities/competition'

/** Кем человек был на соревновании */
export type DocumentRole = 'athlete' | 'coach' | 'judge'

export type DocumentKind = 'certificate' | 'diploma' | 'gramota' | 'thanks' | 'judge_thanks' | 'reference'
export type DocumentScope = CompetitionScope

/** Поля, которые вводит человек. Остальное — ФИО, команда, место, подопечные, QR — подставляет сервер */
export interface DocumentForm {
  title: string
  lead: string
  text: string
  /** Для грамот: всем участникам или призёрам. У остальных видов получатели заданы видом */
  recipients: 'participants' | 'winners'
  places_to: number
  signer_position: string
  signer_name: string
  /** YYYY-MM-DD */
  issued_on: string
  /** Благодарность судьям: кому из коллегии. null — всей коллегии */
  judge_ids?: string[] | null
}

export interface DocumentItem {
  token: string
  number: string
  /** Фамилия И. О. */
  name: string
  role: DocumentRole
  team: string | null
  place: number | null
}

/** Выпущенные документы одного вида по соревнованию */
export interface DocumentGroup {
  kind: DocumentKind
  kind_title: string
  form: {
    title: string
    lead: string | null
    text: string | null
    recipients: 'participants' | 'winners'
    places_to: number
    signer_position: string | null
    signer_name: string | null
    issued_on: string
  }
  items: DocumentItem[]
}

/** Документ на странице проверки по QR */
export interface VerifiedDocument {
  /** Подпись HMAC сходится: данные документа не меняли в обход платформы */
  valid: boolean
  token: string
  number: string
  kind: DocumentKind
  kind_title: string
  title: string
  lead: string | null
  text: string | null
  issued_on: string
  signer_position: string | null
  signer_name: string | null
  recipient: string
  role: DocumentRole
  team: string | null
  place: number | null
  athletes: string[]
  /** Судья: должность в коллегии */
  position: string | null
  contest: {
    id: number
    title: string
    discipline: string
    dates: string
    place: string | null
    organizer: string
  }
}

/** Свой документ в кабинете */
export interface MyDocument {
  token: string
  number: string
  kind: DocumentKind
  kind_title: string
  title: string
  role: DocumentRole
  place: number | null
  issued_on: string
  contest: { id: number; title: string; dates: string }
}

export interface MyDocuments {
  items: MyDocument[]
  /** Соревнования, по которым можно получить справку самому */
  available: { contest: { id: number; title: string; dates: string } }[]
}
