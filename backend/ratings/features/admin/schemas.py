from datetime import date
from decimal import Decimal

from pydantic import BaseModel, Field

from infrastructure.enums import RatingSeason


class RulesIn(BaseModel):
    stability_factor: Decimal = Field(ge=1, le=3, decimal_places=2)
    podium_place: int = Field(ge=1, le=10)
    podium_count: int = Field(ge=1, le=10)
    season: RatingSeason


class RulesOut(BaseModel):
    stability_factor: float
    podium_place: int
    podium_count: int
    season: RatingSeason
    season_title: str
    since: date
    formula: str
