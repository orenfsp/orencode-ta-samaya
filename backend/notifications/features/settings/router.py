from typing import Annotated

from fastapi import APIRouter, Body, Response

from auth.dependencies import CurrentUserDep
from core.config import settings
from notifications.dependencies import NotificationsDep, TelegramDep
from notifications.features.settings.schemas import (
    PreferenceOut,
    PreferencesIn,
    PreferencesOut,
    TelegramLinkOut,
    TelegramOut,
)

router = APIRouter(prefix="/me", tags=["Уведомления"])


async def _preferences(notifications: NotificationsDep, user: CurrentUserDep) -> PreferencesOut:
    """Строит схему настроек уведомлений пользователя."""
    rows = await notifications.preferences(user.id)
    return PreferencesOut(items=[PreferenceOut(group=group, label=label, description=description, email=email,
                                               telegram=telegram, locked=locked)
                                 for group, label, description, email, telegram, locked in rows])


@router.get("/notification-settings", summary="Какие уведомления куда приходят")
async def get_preferences(user: CurrentUserDep, notifications: NotificationsDep) -> PreferencesOut:
    """Возвращает настройки уведомлений пользователя."""
    return await _preferences(notifications, user)


@router.put("/notification-settings", summary="Изменить настройки уведомлений")
async def put_preferences(body: Annotated[PreferencesIn, Body()], user: CurrentUserDep,
                          notifications: NotificationsDep) -> PreferencesOut:
    """Обновляет настройки уведомлений пользователя и возвращает их новый вид."""
    await notifications.set_preferences(user.id, [(item.group, item.channel, item.enabled) for item in body.items])
    return await _preferences(notifications, user)


@router.get("/telegram", summary="Привязка Telegram")
async def get_telegram(user: CurrentUserDep, telegram: TelegramDep) -> TelegramOut:
    """Возвращает состояние привязки Telegram пользователя."""
    link = await telegram.status(user.id)
    return TelegramOut(available=telegram.available, bot=settings.telegram_bot_username, linked=link is not None,
                       username=link.username if link else None, linked_at=link.linked_at if link else None,
                       mailpit_url=settings.mailpit_url)


@router.post("/notifications/test", status_code=204, summary="Проверка доставки во все каналы")
async def test_delivery(user: CurrentUserDep, notifications: NotificationsDep) -> Response:
    """Отправляет тестовое уведомление во все подключённые каналы."""
    await notifications.test(user.id)
    return Response(status_code=204)


@router.post("/telegram/link", summary="Ссылка на бота для привязки")
async def link_telegram(user: CurrentUserDep, telegram: TelegramDep) -> TelegramLinkOut:
    """Возвращает ссылку на бота для привязки Telegram."""
    return TelegramLinkOut(url=await telegram.link_url(user.id))


@router.delete("/telegram", status_code=204, summary="Отвязать Telegram")
async def unlink_telegram(user: CurrentUserDep, telegram: TelegramDep) -> Response:
    """Отвязывает Telegram от аккаунта пользователя."""
    await telegram.unlink(user.id)
    return Response(status_code=204)
