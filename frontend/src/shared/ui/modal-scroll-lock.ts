const owners = new Set<HTMLDialogElement>()
let previousOverflow = ''

/** Блокирует страницу до закрытия последней модалки, сохраняя исходный overflow. */
export function lockModalScroll(dialog: HTMLDialogElement) {
  if (owners.has(dialog)) return
  if (!owners.size) previousOverflow = document.documentElement.style.overflow
  owners.add(dialog)
  document.documentElement.style.overflow = 'hidden'
}

/** Освобождает блокировку окна; закрытие вложенного диалога не разблокирует фон. */
export function unlockModalScroll(dialog: HTMLDialogElement) {
  if (owners.delete(dialog) && !owners.size) document.documentElement.style.overflow = previousOverflow
}
