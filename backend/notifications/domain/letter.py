from email.message import EmailMessage
from pathlib import Path
from html import escape
from urllib.parse import urljoin, urlsplit

from core.config import Settings
from infrastructure.notifications.outbox import OutboxModel

SIGNATURE = "Федерация спортивного программирования Оренбургской области"
FOOTER = "Письмо отправлено автоматически, отвечать на него не нужно."
LOGO = (Path(__file__).resolve().parent.parent / "assets" / "logo.png").read_bytes()
LOGO_CID = "fsp-logo"
INK, MUTED, LIGHT, GRAY, BLUE = "#1b1c21", "#5f6066", "#ededed", "#c8c9ca", "#402fff"
MONO = "'JetBrains Mono',Consolas,'Courier New',monospace"
SANS = "Roboto,Arial,sans-serif"
LOCAL_HOSTS = frozenset({"localhost", "127.0.0.1", "0.0.0.0"})


def _spaced(code: str) -> str:
    """Разбивает шестизначный код на две группы по три цифры для читаемости."""
    return f"{code[:3]} {code[3:]}" if len(code) == 6 else code


class Letter:
    """Сборка письма и текста для Telegram из элемента исходящей очереди."""

    def __init__(self, settings: Settings) -> None:
        """Сохраняет настройки."""
        self._settings = settings

    def url(self, item: OutboxModel) -> str | None:
        """Строит абсолютную ссылку на фронтенд из пути уведомления."""
        return urljoin(self._settings.frontend_url.rstrip("/") + "/", item.link.lstrip("/")) if item.link else None

    def build(self, item: OutboxModel) -> EmailMessage:
        """Собирает письмо с текстовой и HTML-версией и вложенным логотипом."""
        message = EmailMessage()
        message["From"] = self._settings.smtp_sender
        message["To"] = item.recipient
        message["Subject"] = f"{item.code}: {item.title}" if item.code else item.title
        message["Message-ID"] = f"<{item.id}@fsp.local>"
        message.set_content(self._text(item, self.url(item)))
        message.add_alternative(self._html(item, self.url(item)), subtype="html")
        html = message.get_body(("html",))
        if html is not None:
            html.add_related(LOGO, maintype="image", subtype="png", cid=f"<{LOGO_CID}>", filename="fsp.png")
        return message

    def telegram(self, item: OutboxModel) -> tuple[str, list[list[tuple[str, str]]]]:
        """Строит HTML-текст и кнопки сообщения для Telegram."""
        text = f"<b>{escape(item.title)}</b>\n\n{escape(item.text)}"
        row: list[tuple[str, str]] = []
        url = self.url(item)
        if url and (urlsplit(url).hostname or "") not in LOCAL_HOSTS:
            row.append(("Открыть", url))
        if item.notification_id:
            row.append(("Прочитано", f"n:read:{item.notification_id}"))
        return text, [row] if row else []

    def _text(self, item: OutboxModel, link: str | None) -> str:
        """Собирает текстовую версию письма: заголовок, текст, код и ссылку."""
        parts = [item.title, item.text]
        if item.code:
            parts.append(f"Код: {_spaced(item.code)}\nДействует {self._settings.code_ttl_seconds // 60} минут.")
        if link:
            parts.append(link)
        return "\n\n".join(parts + [f"{SIGNATURE}\n{FOOTER}"]) + "\n"

    def _html(self, item: OutboxModel, link: str | None) -> str:
        """Собирает HTML-версию письма с оформлением, кодом и кнопкой перехода."""
        paragraphs = "".join(
            f'<p style="margin:0 0 12px;font-size:15px;line-height:1.55">{escape(line)}</p>'
            for line in item.text.splitlines() if line.strip()
        )
        code = ""
        if item.code:
            code = (
                f'<p style="margin:20px 0 6px;font-family:{MONO};font-size:32px;letter-spacing:6px;color:{INK}">'
                f'{escape(_spaced(item.code))}</p>'
                f'<p style="margin:0;font-size:13px;color:{MUTED}">Действует {self._settings.code_ttl_seconds // 60} минут</p>'
            )
        action = ""
        if link:
            action = (
                f'<a href="{escape(link, quote=True)}" style="display:inline-block;margin-top:12px;padding:11px 20px;'
                f'background:{BLUE};color:#ffffff;text-decoration:none;border-radius:8px;font-size:15px">Открыть</a>'
            )
        return (
            '<!doctype html><html lang="ru"><head><meta charset="utf-8">'
            '<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"></head>'
            f'<body style="margin:0;padding:0;background:{LIGHT}">'
            f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{LIGHT};padding:24px 12px">'
            '<tr><td align="center">'
            '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">'
            f'<tr><td style="padding:4px 4px 20px"><img src="cid:{LOGO_CID}" width="240" height="30" alt="ФСП" '
            'style="display:block;border:0;width:240px;height:auto"></td></tr>'
            f'<tr><td style="padding:28px;background:#ffffff;border:1px solid {GRAY};border-radius:12px;'
            f'font-family:{SANS};color:{INK}">'
            f'<h1 style="margin:0 0 14px;font-family:{MONO};font-size:20px;font-weight:500;line-height:1.35">{escape(item.title)}</h1>'
            f'{paragraphs}{code}{action}</td></tr>'
            f'<tr><td style="padding:16px 4px 0;font-family:{SANS};font-size:12px;line-height:1.5;color:{MUTED}">'
            f'{SIGNATURE}<br>{FOOTER}</td></tr>'
            '</table></td></tr></table></body></html>'
        )
