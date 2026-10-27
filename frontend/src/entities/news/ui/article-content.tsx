import { IconDownload, IconExternal } from '@/shared/ui'
import { attachmentUrl } from '../lib/describe'
import type { Block } from '../model/types'
import { NewsCover } from './news-cover'

/** Только http(s): ссылку вида javascript: не рендерим, даже если она как-то попала в данные */
const safeUrl = (url: string) => (/^https?:\/\//i.test(url) ? url : undefined)

/** Тело статьи из блоков. Одна вёрстка для сайта и предпросмотра в редакторе */
export function ArticleContent({ blocks }: { blocks: Block[] }) {
  return (
    <div className="flex min-w-0 flex-col gap-5 text-lead [overflow-wrap:anywhere]">
      {blocks.map((block, index) => {
        switch (block.type) {
          case 'heading':
            return block.level === 2 ? (
              <h2 key={index} className="pt-3 text-h2 font-medium">
                {block.text}
              </h2>
            ) : (
              <h3 key={index} className="pt-2 text-h3 font-medium">
                {block.text}
              </h3>
            )
          case 'text':
            return (
              <p key={index} className="whitespace-pre-wrap text-ink">
                {block.text}
              </p>
            )
          case 'image':
            return (
              <figure key={index} className="flex flex-col gap-2">
                <NewsCover fileId={block.file_id} alt={block.alt ?? ''} className="rounded-lg" />
                {block.caption && <figcaption className="text-sm text-muted">{block.caption}</figcaption>}
              </figure>
            )
          case 'file':
            return (
              <a
                key={index}
                href={attachmentUrl(block.file_id)}
                className="flex items-center gap-3 self-start rounded-lg border border-line-soft px-4 py-3 text-body text-ink transition-colors hover:border-primary hover:text-primary-text"
              >
                <IconDownload size={18} className="shrink-0" />
                {block.title || 'Файл'}
              </a>
            )
          case 'link':
            return (
              <a
                key={index}
                href={safeUrl(block.url)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 self-start link-underline text-body text-primary-text"
              >
                {block.title || block.url}
                <IconExternal size={16} className="shrink-0" />
                <span className="sr-only">(откроется в новой вкладке)</span>
              </a>
            )
        }
      })}
    </div>
  )
}
