from typing import List
from fastapi import FastAPI, Path, Query
from fastapi.middleware.cors import CORSMiddleware

from . import schemas
from . import services

app = FastAPI(
    title="TERRA-LENS API",
    description="Planetary Analog Discovery Workbench - Geospatial & Multi-Sensor Diagnostic Engine",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "*"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def home():
    return {
        "message": "TERRA-LENS API is running!",
        "status": "online",
        "service": "Planetary Analog Discovery Engine",
        "version": "1.0.0",
        "endpoints": [
            "/targets",
            "/analogs",
            "/diagnostics/{target_id}/{analog_id}",
            "/rank-analogs"
        ]
    }


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "subsystems": {
            "catalog": "nominal",
            "scoring_engine": "nominal",
            "diagnostics": "nominal"
        }
    }


@app.get("/targets", response_model=List[schemas.TargetModel])
def get_targets():
    """Returns all available planetary targets with multi-sensor layers and metadata."""
    return services.list_targets()


@app.get("/analogs", response_model=List[schemas.AnalogModel])
def get_analogs():
    """Returns all 5 curated Earth analog sites with coordinates and multi-sensor layer paths."""
    return services.list_analogs()


@app.get("/diagnostics/{target_id}/{analog_id}", response_model=schemas.DiagnosticsResponse)
def get_diagnostics(
    target_id: str = Path(..., description="Planetary target identifier (e.g. 'shackleton', 'jezero')"),
    analog_id: str = Path(..., description="Earth analog identifier (e.g. 'tablelands', 'tuktoyaktuk')")
):
    """Returns sensor stats, radar chart vectors, and 3-tier Match/Breakdown/Mitigation diagnostics."""
    return services.get_diagnostics(target_id, analog_id)


@app.post("/rank-analogs", response_model=schemas.RankResponse)
def rank_analogs(request: schemas.RankRequest):
    """
    Ranks all 5 Earth analogs for a given target based on weighted multi-criteria similarity.
    Safely normalizes weights (sum = 1) and computes composite score S = sum(w_i * m_i).
    """
    return services.rank_analogs(request)
