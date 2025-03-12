from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import declarative_base
from datetime import datetime

Base = declarative_base()

class Reservoir(Base):
    __tablename__ = "reservoirs"
    id = Column(Integer, primary_key=True)
    name = Column(String(255), unique=True, nullable=False)
    lat = Column(Float)
    lon = Column(Float)
    fili = Column(String(50))

class ReservoirStatus(Base):
    __tablename__ = "reservoir_status"
    id = Column(Integer, primary_key=True)
    reservoir_id = Column(Integer, ForeignKey("reservoirs.id"), nullable=False)
    npu = Column(Float)
    npu_2024 = Column(Float)
    npu_2025 = Column(Float)
    volume = Column(Float)
    fpu_volume = Column(Float)
    volume_2024 = Column(Float)
    volume_2025 = Column(Float)
    filling = Column(Float)
    free_volume = Column(Float)
    daily_inflow_2024 = Column(Float)
    daily_inflow_2025 = Column(Float)
    daily_outflow_2024 = Column(Float)
    daily_outflow_2025 = Column(Float)
    max_capacity = Column(Float)
    min_volume = Column(String(255))
    timestamp = Column(DateTime, default=datetime.utcnow)