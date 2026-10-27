import { routes } from '@/shared/config'
import { Button, IconArrowRight } from '@/shared/ui'

export function NotFoundPage() {
  return (
    <section className="container-page grid place-items-center py-20 sm:py-28">
      <div className="flex max-w-md flex-col items-center gap-5 text-center">
        <p className="text-display font-medium text-primary">404</p>
        <h1 className="text-h2 font-medium text-ink">Такой страницы нет</h1>
        <p className="text-body text-muted">Возможно, ссылка устарела или в адресе опечатка.</p>
        <Button to={routes.home} rightIcon={<IconArrowRight size={18} />}>
          На главную
        </Button>
      </div>
    </section>
  )
}
