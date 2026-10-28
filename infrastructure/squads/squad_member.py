import uuid

from sqlalchemy import ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from infrastructure.base import Base
from infrastructure.account.user import UserModel


class SquadMemberModel(Base):
    __tablename__ = "squad_members"
    __table_args__ = (
        UniqueConstraint("squad_id", "user_id", name="uq_squad_members_squad_user"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    squad_id: Mapped[int] = mapped_column(ForeignKey("squads.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    position: Mapped[int] = mapped_column(Integer)
    is_reserve: Mapped[bool] = mapped_column()
    points: Mapped[int] = mapped_column(Integer)

    user: Mapped[UserModel] = relationship(
        lazy="selectin",
    )
