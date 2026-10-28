from uuid import UUID

from pydantic import BaseModel, ConfigDict


class ModerationIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    hidden_by_federation: bool


class ModeratedOut(BaseModel):
    id: UUID
    hidden_by_federation: bool
