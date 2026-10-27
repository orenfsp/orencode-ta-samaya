import type { Block, BlockType } from '@/entities/news'

/** Пустой блок каждого типа — с ним начинается новый блок в редакторе */
export const emptyBlock: Record<BlockType, Block> = {
  heading: { type: 'heading', text: '', level: 2 },
  text: { type: 'text', text: '' },
  image: { type: 'image', file_id: '', caption: null, alt: null },
  file: { type: 'file', file_id: '', title: '' },
  link: { type: 'link', url: '', title: '' },
}
