/** Статья новостей по контракту API_DOCUMENTATION.md, раздел «Новости» */

export type Block =
  | { type: 'heading'; text: string; level: 2 | 3 }
  | { type: 'text'; text: string }
  | { type: 'image'; file_id: string; caption: string | null; alt: string | null }
  | { type: 'file'; file_id: string; title: string }
  | { type: 'link'; url: string; title: string }

export type BlockType = Block['type']

export type NewsStatus = 'draft' | 'published' | 'archived'

export interface ArticleInput {
  title: string
  section: string | null
  summary: string | null
  cover_file_id: string | null
  blocks: Block[]
  hashtags: string[]
}

/** Опубликованная статья на сайте */
export interface Article extends ArticleInput {
  id: string
  slug: string
  published_at: string | null
  views: number
}

/** Статья в кабинете федерации: со статусом и датами правки */
export interface AdminArticle extends Article {
  status: NewsStatus
  created_at: string
  updated_at: string
}

export interface NewsPage<T = Article> {
  items: T[]
  total: number
}

export interface NewsTag {
  name: string
  count: number
}

export type NewsTransition = 'publish' | 'unpublish' | 'archive' | 'restore'
