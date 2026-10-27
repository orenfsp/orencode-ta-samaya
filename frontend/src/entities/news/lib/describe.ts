import { fileUrl } from '@/shared/api'
import type { StatusTone } from '@/shared/ui'
import type { BlockType, NewsStatus } from '../model/types'

export const attachmentUrl = (id: string) => fileUrl(`/files/${id}`)

export const statusTitles: Record<NewsStatus, string> = {
  draft: 'Черновик',
  published: 'Опубликована',
  archived: 'В архиве',
}

export const statusTone: Record<NewsStatus, StatusTone> = {
  draft: 'draft',
  published: 'active',
  archived: 'done',
}

export const blockTitles: Record<BlockType, string> = {
  heading: 'Заголовок',
  text: 'Текст',
  image: 'Изображение',
  file: 'Файл',
  link: 'Ссылка',
}

const long = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Asia/Yekaterinburg',
})

/** «13 октября 2026» — по Оренбургу */
export const newsDate = (date: string) => long.format(new Date(date))

/** «Ф С П , фсп,  олимпиада» → ['фсп', 'олимпиада']: без решётки, без повторов, в нижнем регистре */
export const parseHashtags = (text: string) => [
  ...new Set(
    text
      .split(/[,\s]+/)
      .map((tag) => tag.replace(/^#/, '').trim().toLowerCase())
      .filter(Boolean),
  ),
]
