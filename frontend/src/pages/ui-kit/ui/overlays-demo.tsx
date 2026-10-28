import { useState } from 'react'
import { Button, ConfirmModal, Field, Input, Modal, ReasonModal, showToast } from '@/shared/ui'
import { Row, Section } from './section'

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export function OverlaysDemo() {
  const [modalOpen, setModalOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [reasonOpen, setReasonOpen] = useState(false)
  const [failedOpen, setFailedOpen] = useState(false)

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
        <Row label="Длинное описание из ячейки действий">
          <div className="text-right font-mono whitespace-nowrap">
            <Button variant="secondary" onClick={() => setReasonOpen(true)}>
              Вернуть роль на проверку
            </Button>
            <ReasonModal
              open={reasonOpen}
              onClose={() => setReasonOpen(false)}
              title="Вернуть роль на проверку?"
              description="Зайцев Роман Олегович, роль «Судья». Кабинет судьи закроется до нового решения. Дополнительные сведения: https://example.test/abcdefghijklmnopqrstuvwxyz0123456789abcdefghijklmnopqrstuvwxyz0123456789"
              label="Комментарий для журнала"
              confirmLabel="Вернуть роль на повторную проверку федерации"
              tone="primary"
              pending={false}
              error={null}
              onSubmit={() => setReasonOpen(false)}
            />
          </div>
        </Row>
        <Row label="Ошибка при подтверждении">
          <Button variant="secondary" onClick={() => setFailedOpen(true)}>
            Проверить ошибку
          </Button>
          <ConfirmModal
            open={failedOpen}
            onClose={() => setFailedOpen(false)}
            onConfirm={async () => {
              await wait(400)
              throw new Error('Действие не выполнено. Проверьте соединение и попробуйте ещё раз')
            }}
            title="Подтвердить действие?"
            description="Пример ответа с ошибкой: окно остаётся открытым, запрос можно повторить."
            confirmLabel="Подтвердить"
          />
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
