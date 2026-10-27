import { createContext, useContext } from 'react'

/**
 * Куда выносить всплывающие слои. Внутри <dialog> это сам диалог: он в верхнем слое браузера,
 * и всё, что вынесено в body, оказалось бы под ним и инертным.
 */
export const PortalContext = createContext<HTMLElement | null>(null)

export function usePortalTarget() {
  return useContext(PortalContext) ?? (typeof document === 'undefined' ? null : document.body)
}
