/**
 * Официальная иконка дисциплины из public/brand по названию из справочника.
 * Без \w и \b: в регулярках JS они не понимают кириллицу. Нет совпадения — общая иконка в том же стиле.
 */
export function disciplineIconName(name: string | null | undefined) {
  const text = (name ?? '').toLowerCase()
  if (text.includes('алгоритм') || text.includes('олимпиад')) return 'algorithmic'
  if (text.includes('продукт') || text.includes('хакатон')) return 'product'
  if (text.includes('безопасн') || text.includes('ctf') || text.includes('кибер')) return 'security'
  if (text.includes('искусствен') || text.includes('машинн')) return 'ai'
  if (text.includes('робот')) return 'robotics'
  if (text.includes('беспилот') || text.includes('бпла') || text.includes('дрон')) return 'drones'
  if (text.includes('квиз') || text.includes('викторин') || text.includes('интеллектуальн')) return 'quiz'
  return 'generic'
}
