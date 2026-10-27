import { request, type Query } from '@/shared/api'
import type {
  AdminArticle,
  Article,
  ArticleInput,
  Block,
  NewsPage,
  NewsTag,
  NewsTransition,
} from '../model/types'

/** На бэк уходят только поля своего типа блока: лишние ключи из формы он отклонит */
function cleanBlock(block: Block): Block {
  switch (block.type) {
    case 'heading':
      return { type: 'heading', level: block.level, text: block.text }
    case 'text':
      return { type: 'text', text: block.text }
    case 'image':
      return { type: 'image', file_id: block.file_id, caption: block.caption, alt: block.alt }
    case 'file':
      return { type: 'file', file_id: block.file_id, title: block.title }
    case 'link':
      return { type: 'link', url: block.url.trim(), title: block.title.trim() || block.url.trim() }
  }
}

const clean = (body: ArticleInput): ArticleInput => ({ ...body, blocks: body.blocks.map(cleanBlock) })

export const newsApi = {
  list: (query: Query) => request<NewsPage>('/news', { query }),
  tags: () => request<NewsTag[]>('/news/tags'),
  detail: (slug: string) => request<Article>(`/news/${slug}`),
  adminList: (query: Query) => request<NewsPage<AdminArticle>>('/admin/news', { query }),
  adminDetail: (id: string) => request<AdminArticle>(`/admin/news/${id}`),
  create: (body: ArticleInput) => request<AdminArticle>('/admin/news', { method: 'POST', body: clean(body) }),
  update: (id: string, body: ArticleInput) =>
    request<AdminArticle>(`/admin/news/${id}`, { method: 'PATCH', body: clean(body) }),
  transition: (id: string, action: NewsTransition) =>
    request<AdminArticle>(`/admin/news/${id}/${action}`, { method: 'POST' }),
}
