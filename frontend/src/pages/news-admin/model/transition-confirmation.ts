import type { NewsTransition } from '@/entities/news'

export const newsConfirmation: Record<NewsTransition, { title: string; description: string; label: string }> =
  {
    publish: {
      title: 'Опубликовать статью?',
      description: 'Статья станет доступна всем посетителям сайта.',
      label: 'Опубликовать',
    },
    unpublish: {
      title: 'Снять статью с публикации?',
      description: 'Статья исчезнет с сайта и вернётся в черновики.',
      label: 'Снять с публикации',
    },
    archive: {
      title: 'Отправить статью в архив?',
      description: 'Статья исчезнет с сайта. Текст и вложения сохранятся.',
      label: 'В архив',
    },
    restore: {
      title: 'Вернуть статью в черновики?',
      description: 'Статью можно будет редактировать. На сайте она появится после повторной публикации.',
      label: 'Вернуть в черновики',
    },
  }
