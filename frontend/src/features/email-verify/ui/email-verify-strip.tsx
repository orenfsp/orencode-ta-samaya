import { useState } from 'react'
import { cn } from '@/shared/lib'
import { Button, IconMail, Modal } from '@/shared/ui'
import { EmailVerifyForm } from './email-verify-form'

/** Узкая полоса над разделом кабинета: почта не подтверждена. Код вводится в окне, а не сбоку на странице */
export function EmailVerifyStrip({ email, className }: { email: string; className?: string }) {
  const [state, setState] = useState({ open: false, key: 0 })
  const close = () => setState((current) => ({ ...current, open: false }))
  return (
    <>
      <div
        className={cn(
          'flex flex-wrap items-center gap-x-4 gap-y-3 rounded-lg border border-live/40 bg-live-soft px-4 py-3',
          className,
        )}
      >
        <IconMail size={18} className="shrink-0 text-live-text" />
        <p className="min-w-0 flex-1 text-sm text-ink">
          Почта <span className="break-all">{email}</span> не подтверждена
        </p>
        <Button size="sm" onClick={() => setState((current) => ({ open: true, key: current.key + 1 }))}>
          Ввести код
        </Button>
      </div>
      <Modal
        open={state.open}
        onClose={close}
        title="Подтверждение почты"
        size="md"
        footer={
          <Button variant="ghost" onClick={close}>
            Позже
          </Button>
        }
      >
        <EmailVerifyForm key={state.key} email={email} title="" onDone={close} />
      </Modal>
    </>
  )
}
