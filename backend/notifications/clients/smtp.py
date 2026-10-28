import asyncio
import smtplib
import ssl
from email.message import EmailMessage

from core.config import Settings


class SmtpClient:
    """Отправка писем через SMTP."""

    def __init__(self, settings: Settings) -> None:
        """Сохраняет настройки."""
        self._settings = settings

    async def send(self, message: EmailMessage) -> None:
        """Отправляет письмо через SMTP в отдельном потоке."""
        await asyncio.to_thread(self._send, message)

    def _send(self, message: EmailMessage) -> None:
        """Синхронно подключается к SMTP-серверу и отправляет письмо."""
        config = self._settings
        client = smtplib.SMTP_SSL(config.smtp_host, config.smtp_port, timeout=10, context=ssl.create_default_context()) if config.smtp_tls_mode == "ssl" else smtplib.SMTP(config.smtp_host, config.smtp_port, timeout=10)
        with client as smtp:
            if config.smtp_tls_mode == "starttls":
                smtp.starttls(context=ssl.create_default_context())
            if config.smtp_username:
                smtp.login(config.smtp_username, config.smtp_password.get_secret_value() if config.smtp_password else "")
            refused = smtp.send_message(message)
            if refused:
                raise smtplib.SMTPRecipientsRefused(refused)
