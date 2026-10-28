import { useEffect, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router'
import { routes } from '@/shared/config'
import { cn } from '@/shared/lib'
import { Button, EmptyState, IconSearch, Input, PageHeader, SectionHeader, Select } from '@/shared/ui'
import { GLOSSARY } from './terms'

const normalize = (text: string) => text.toLowerCase().replaceAll('ё', 'е')
const termDestinations: Record<string, string> = {
  rating: routes.cabinetRating('athlete'),
  appeal: routes.cabinetDisputes('athlete'),
  coach: routes.cabinetCoachAthletes,
  judge: routes.cabinetQualification('judge'),
  organization: routes.cabinetOrganizations,
}
const destinations = [
  routes.cabinetQualification('athlete'),
  routes.competitions,
  routes.cabinetAthleteProfile,
  routes.cabinetAthleteProfile,
  routes.cabinet,
]
const sectionsWithIds = GLOSSARY.map((section, index) => ({
  ...section,
  id: `section-${index + 1}`,
  to: destinations[index],
  items: section.items,
}))

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>
  const needle = normalize(query)
  const source = normalize(text)
  const parts = []
  let offset = 0
  let start = source.indexOf(needle)
  while (start >= 0) {
    parts.push(
      text.slice(offset, start),
      <mark key={start} className="rounded-sm bg-primary-soft text-ink">
        {text.slice(start, start + needle.length)}
      </mark>,
    )
    offset = start + needle.length
    start = source.indexOf(needle, offset)
  }
  parts.push(text.slice(offset))
  return <>{parts}</>
}

/** Справочник с оглавлением, поиском и постоянными ссылками на термины. */
export function GlossaryPage() {
  const [params, setParams] = useSearchParams()
  const { hash } = useLocation()
  const q = (params.get('q') ?? '').slice(0, 300)
  const needle = normalize(q.trim())
  const [active, setActive] = useState('section-1')
  const sections = sectionsWithIds
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) => !needle || normalize(`${item.term} ${item.text}`).includes(needle),
      ),
    }))
    .filter((section) => section.items.length)
  const sectionKey = sections.map((section) => section.id).join(',')
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries.find((entry) => entry.isIntersecting)
        if (first) setActive(first.target.id)
      },
      { rootMargin: '-15% 0px -60% 0px' },
    )
    sectionKey.split(',').forEach((id) => {
      const element = document.getElementById(id)
      if (element) observer.observe(element)
    })
    return () => observer.disconnect()
  }, [sectionKey])
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' })
  }, [hash])
  const search = (value: string) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        if (value) next.set('q', value)
        else next.delete('q')
        return next
      },
      { replace: true },
    )
  return (
    <article className="container-page flex flex-col gap-8 py-8 sm:py-12">
      <PageHeader
        title="Справочник понятий"
        description="Разряды, соревнования и антидопинг простым языком"
        crumbs={[{ label: 'Главная', to: routes.home }, { label: 'Справочник понятий' }]}
      />
      <Input
        type="search"
        aria-label="Поиск по справочнику"
        leftIcon={<IconSearch size={18} />}
        placeholder="Например, КМС или первенство"
        value={q}
        maxLength={300}
        onChange={(event) => search(event.target.value)}
      />
      {!sections.length ? (
        <EmptyState
          title="Ничего не нашли"
          description="Попробуйте другое слово или сбросьте поиск"
          action={
            <Button variant="secondary" onClick={() => search('')}>
              Сбросить поиск
            </Button>
          }
        />
      ) : (
        <div className="grid items-start gap-8 lg:grid-cols-[16rem_minmax(0,1fr)]">
          <nav aria-label="Разделы справочника" className="lg:sticky lg:top-28">
            <div className="lg:hidden">
              <Select
                aria-label="Перейти к разделу"
                value={sections.some((section) => section.id === active) ? active : sections[0].id}
                options={sections.map((section) => ({ value: section.id, label: section.title }))}
                onChange={(event) => {
                  setActive(event.target.value)
                  document.getElementById(event.target.value)?.scrollIntoView({ block: 'start' })
                }}
              />
            </div>
            <ul className="hidden flex-col gap-1 lg:flex">
              {sections.map((section) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    aria-current={active === section.id ? 'location' : undefined}
                    className={cn(
                      'block rounded-md px-3 py-2 text-sm outline-none focus-visible:field-focus',
                      active === section.id
                        ? 'bg-primary-soft text-primary-text'
                        : 'text-muted hover:text-ink',
                    )}
                  >
                    {section.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="flex min-w-0 flex-col gap-10">
            {sections.map((section) => (
              <section id={section.id} key={section.id} className="flex scroll-mt-28 flex-col gap-4">
                <SectionHeader title={section.title} />
                <div className="grid gap-4 md:grid-cols-2">
                  {section.items.map((item) => (
                    <article id={item.id} key={item.id} className="flex scroll-mt-28 flex-col gap-3 card p-5">
                      <h3 className="font-mono text-body font-medium">
                        <a href={`#${item.id}`} className="link-underline">
                          <Highlight text={item.term} query={q.trim()} />
                        </a>
                      </h3>
                      <p className="text-body text-muted">
                        <Highlight text={item.text} query={q.trim()} />
                      </p>
                      <div className="mt-auto flex flex-wrap gap-x-4 gap-y-2 pt-2 text-sm">
                        {item.links?.map((link) => (
                          <a
                            key={link.href}
                            href={link.href}
                            target="_blank"
                            rel="noreferrer"
                            className="link-underline"
                          >
                            {link.label} ↗
                          </a>
                        ))}
                        <Link to={termDestinations[item.id] ?? section.to} className="link-underline">
                          Где в платформе
                        </Link>
                        <a
                          href={`#${item.id}`}
                          className="link-underline"
                          aria-label={`Ссылка на термин «${item.term}»`}
                        >
                          Ссылка на термин
                        </a>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      )}
    </article>
  )
}
