import { useState } from 'react'
import { Button, ConfirmModal, Field, Input, Modal, showToast } from '@/shared/ui'
import { Row, Section } from './section'

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export function OverlaysDemo() {
  const [modalOpen, setModalOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  return (
    <Section
      id="overlays"
      title="Окна и уведомления"
      description="Модалка на нативном <dialog>: фокус, Escape и клик по фону. На телефоне выезжает снизу. Тосты всплывают с пружинкой и сами гаснут через 4 секунды."
    >
      <div className="grid gap-8 sm:grid-cols-2">
        <Row label="Окна">
          <Button onClick={() => setModalOpen(true)}>Открыть окно</Button>
          <Button variant="secondary" onClick={() => setConfirmOpen(true)}>
            Отклонить заявку
          </Button>
        </Row>
        <Row label="Тосты">
          <Button variant="secondary" onClick={() => showToast('Заявка отправлена', { tone: 'success' })}>
            Успех
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              showToast('Не удалось сохранить', {
                tone: 'danger',
                description: 'Проверьте соединение и повторите',
              })
            }
          >
            Ошибка
          </Button>
          <Button variant="ghost" onClick={() => showToast('Черновик сохранён')}>
            Инфо
          </Button>
        </Row>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Причина отклонения"
        description="Участник увидит её в уведомлении и в статусе заявки"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Отмена
            </Button>
            <Button
              onClick={() => {
                setModalOpen(false)
                showToast('Причина сохранена', { tone: 'success' })
              }}
            >
              Сохранить
            </Button>
          </>
        }
      >
        <Field label="Комментарий" required>
          <Input placeholder="Например: не приложено согласие родителя" autoFocus />
        </Field>
      </Modal>

      <ConfirmModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={async () => {
          await wait(900)
          showToast('Заявка отклонена', { tone: 'danger' })
        }}
        title="Отклонить заявку?"
        description="Спортсмен получит уведомление. Решение можно будет изменить только через новую заявку."
        confirmLabel="Отклонить"
        tone="danger"
      />
    </Section>
  )
}
