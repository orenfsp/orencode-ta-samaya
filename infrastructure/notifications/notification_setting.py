import uuid

from sqlalchemy import Enum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from infrastructure.base import Base
from infrastructure.enums import Channel


class NotificationSettingModel(Base):
    __tablename__ = "notification_settings"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    group: Mapped[str] = mapped_column(String(30), primary_key=True)
    channel: Mapped[Channel] = mapped_column(Enum(Channel, name="channel", values_callable=lambda cls: [value.value for value in cls]), primary_key=True)
    enabled: Mapped[bool] = mapped_column(default=True)
