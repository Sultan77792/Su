from fastapi import FastAPI, Depends, HTTPException, WebSocket
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.future import select as future_select
import io
import xlsxwriter
from models import Base, Reservoir, ReservoirStatus
from schemas import ReservoirStatusCreate  # You'll need to define this schema
from database import get_db  # You'll need to implement this dependency
from datetime import datetime
from typing import List
import asyncio

app = FastAPI()

# Database configuration
DATABASE_URL = "postgresql+asyncpg://user:password@db:5432/reservoirs"
engine = create_async_engine(DATABASE_URL, echo=True)

# WebSocket connections
connected_clients = []

# WebSocket endpoint
@app.websocket("/ws/reservoirs")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connected_clients.append(websocket)
    try:
        while True:
            await websocket.receive_text()  # Keep connection alive
    except:
        connected_clients.remove(websocket)

# Broadcast function
async def broadcast(message):
    for client in connected_clients:
        await client.send_json(message)

# Startup event
@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

# Get all reservoirs
@app.get("/api/reservoirs/all", response_model=List[ReservoirStatusCreate])
async def get_all_reservoirs(db: AsyncSession = Depends(get_db)):
    async with db as session:
        result = await session.execute(select(Reservoir))
        reservoirs = result.scalars().all()
        return [{"id": r.id, "name": r.name, "lat": r.lat, "lon": r.lon, "fili": r.fili} 
                for r in reservoirs]

# Get latest status for a specific reservoir
@app.get("/api/reservoirs/{id}/latest", response_model=ReservoirStatusCreate)
async def get_latest_status(id: int, db: AsyncSession = Depends(get_db)):
    async with db as session:
        result = await session.execute(
            select(ReservoirStatus)
            .where(ReservoirStatus.reservoir_id == id)
            .order_by(ReservoirStatus.timestamp.desc())
            .limit(1)
        )
        status = result.scalar_one_or_none()
        if not status:
            raise HTTPException(status_code=404, detail="Данные не найдены")
        return {
            "reservoir_id": status.reservoir_id,
            "filling": status.filling,
            "water_level": status.water_level,
            "pollution_level": status.pollution_level,
            "timestamp": status.timestamp
        }

# Submit reservoir data
@app.post("/submit_data/")
async def submit_data(data: dict, db: AsyncSession = Depends(get_db)):
    async with db as session:
        for reservoir in data.get("waterReservoirs", []):
            # Check if reservoir exists
            result = await session.execute(
                select(Reservoir).where(Reservoir.name == reservoir["name"])
            )
            res = result.scalar_one_or_none()
            
            if not res:
                new_res = Reservoir(
                    name=reservoir["name"], 
                    fili=reservoir["fili"], 
                    lat=None, 
                    lon=None
                )
                session.add(new_res)
                await session.flush()
                reservoir_id = new_res.id
            else:
                reservoir_id = res.id

            # Create new status
            status = ReservoirStatus(
                reservoir_id=reservoir_id,
                npu=float(reservoir.get("npu")) if reservoir.get("npu") else None,
                npu_2024=float(reservoir.get("npu_2024")) if reservoir.get("npu_2024") else None,
                npu_2025=float(reservoir.get("npu_2025")) if reservoir.get("npu_2025") else None,
                volume=float(reservoir.get("volume")) if reservoir.get("volume") else None,
                fpu_volume=float(reservoir.get("fpu_volume")) if reservoir.get("fpu_volume") else None,
                volume_2024=float(reservoir.get("volume_2024")) if reservoir.get("volume_2024") else None,
                volume_2025=float(reservoir.get("volume_2025")) if reservoir.get("volume_2025") else None,
                filling=float(reservoir.get("filling")) if reservoir.get("filling") else None,
                free_volume=float(reservoir.get("free_volume")) if reservoir.get("free_volume") else None,
                daily_inflow_2024=float(reservoir.get("daily_inflow_2024")) if reservoir.get("daily_inflow_2024") else None,
                daily_inflow_2025=float(reservoir.get("daily_inflow_2025")) if reservoir.get("daily_inflow_2025") else None,
                daily_outflow_2024=float(reservoir.get("daily_outflow_2024")) if reservoir.get("daily_outflow_2024") else None,
                daily_outflow_2025=float(reservoir.get("daily_outflow_2025")) if reservoir.get("daily_outflow_2025") else None,
                max_capacity=float(reservoir.get("max_capacity")) if reservoir.get("max_capacity") else None,
                min_volume=reservoir.get("min_volume"),
                water_level=float(reservoir.get("water_level")) if reservoir.get("water_level") else None,
                pollution_level=float(reservoir.get("pollution_level")) if reservoir.get("pollution_level") else None,
                timestamp=datetime.utcnow()
            )
            session.add(status)
        
        await session.commit()

        # Broadcast update
        await broadcast({
            "id": reservoir_id,
            "name": reservoir["name"],
            "lat": res.lat if res else None,
            "lon": res.lon if res else None,
            "fill_percent": reservoir.get("filling")
        })
    
    return {"status": "success"}

# Generate Excel report
@app.post("/generate-excel")
async def generate_excel(data: dict):
    output = io.BytesIO()
    workbook = xlsxwriter.Workbook(output)
    worksheet = workbook.add_worksheet()
    
    worksheet.write("A1", f"Ежедневная информация по водохранилищам {data['organization']} по состоянию на {data['date']}")
    worksheet.write("A2", f"Исполнитель: {data['executor']}")

    headers = [
        "№ п/п", "Наименование водохранилища", "НПУ", "2024", "2025", "НПУ", "ФПУ", "2024", "2025",
        "Наполнение, %", "Свободная емкость, млн.м³", "Приток 2024", "Приток 2025", "Сброс 2024", "Сброс 2025",
        "Макс. пропускная способность, м³/с", "Минимальный объем, млн.м³; год", "Уровень воды", "Уровень загрязнения"
    ]
    
    for col, header in enumerate(headers):
        worksheet.write(3, col, header)

    for row, reservoir in enumerate(data["waterReservoirs"], start=4):
        worksheet.write(row, 0, row - 3)
        worksheet.write(row, 1, reservoir["name"])
        worksheet.write(row, 2, float(reservoir["npu"]) if reservoir.get("npu") else "")
        worksheet.write(row, 3, float(reservoir["npu_2024"]) if reservoir.get("npu_2024") else "")
        worksheet.write(row, 4, float(reservoir["npu_2025"]) if reservoir.get("npu_2025") else "")
        worksheet.write(row, 5, float(reservoir["volume"]) if reservoir.get("volume") else "")
        worksheet.write(row, 6, float(reservoir["fpu_volume"]) if reservoir.get("fpu_volume") else "")
        worksheet.write(row, 7, float(reservoir["volume_2024"]) if reservoir.get("volume_2024") else "")
        worksheet.write(row, 8, float(reservoir["volume_2025"]) if reservoir.get("volume_2025") else "")
        worksheet.write(row, 9, float(reservoir["filling"]) if reservoir.get("filling") else "")
        worksheet.write(row, 10, float(reservoir["free_volume"]) if reservoir.get("free_volume") else "")
        worksheet.write(row, 11, float(reservoir["daily_inflow_2024"]) if reservoir.get("daily_inflow_2024") else "")
        worksheet.write(row, 12, float(reservoir["daily_inflow_2025"]) if reservoir.get("daily_inflow_2025") else "")
        worksheet.write(row, 13, float(reservoir["daily_outflow_2024"]) if reservoir.get("daily_outflow_2024") else "")
        worksheet.write(row, 14, float(reservoir["daily_outflow_2025"]) if reservoir.get("daily_outflow_2025") else "")
        worksheet.write(row, 15, float(reservoir["max_capacity"]) if reservoir.get("max_capacity") else "")
        worksheet.write(row, 16, reservoir["min_volume"] or "")
        worksheet.write(row, 17, float(reservoir["water_level"]) if reservoir.get("water_level") else "")
        worksheet.write(row, 18, float(reservoir["pollution_level"]) if reservoir.get("pollution_level") else "")
    
    workbook.close()
    output.seek(0)
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=water_reservoirs_{data['date'].replace(' ', '_')}.xlsx"}
    )