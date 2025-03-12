from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class ReservoirStatusCreate(BaseModel):
    reservoir_id: int
    water_level: Optional[float] = None
    pollution_level: Optional[float] = None
    timestamp: Optional[datetime] = None
    filling: Optional[float] = None
    # Add other fields as needed