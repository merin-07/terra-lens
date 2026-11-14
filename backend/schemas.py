from typing import Dict, List, Optional
from pydantic import BaseModel, Field


class LayerInfo(BaseModel):
    name: str
    agency: str
    path: str
    resolution: str
    wavelength: str
    description: Optional[str] = None


class BaselineProfile(BaseModel):
    slope: float
    radar_roughness: float
    thermal: float
    geochemical: float


class TargetModel(BaseModel):
    id: str
    name: str
    body: str
    coordinates: str
    latitude: float
    longitude: float
    elevation: str
    geologic_setting: str
    primary_challenges: List[str] = Field(default_factory=list)
    baseline_profile: BaselineProfile
    layers: Dict[str, LayerInfo]


class AnalogModel(BaseModel):
    id: str
    name: str
    formal_name: str
    country: str
    region: str
    coordinates: str
    latitude: float
    longitude: float
    elevation: str
    climate: str
    lithology: str
    geologic_context: str
    mission_relevance: str
    layers: Dict[str, LayerInfo]


class WeightsInput(BaseModel):
    slope: float = 25.0
    radar_roughness: float = 25.0
    thermal: float = 25.0
    geochemical: float = 25.0


class RankRequest(BaseModel):
    target_id: str
    weights: WeightsInput


class ScoreBreakdown(BaseModel):
    slope: float
    radar_roughness: float
    thermal: float
    geochemical: float


class RankedAnalogItem(BaseModel):
    rank: int
    analog_id: str
    name: str
    region: str
    country: str
    coordinates: str
    composite_score: float
    scores: ScoreBreakdown
    normalized_weights: ScoreBreakdown
    analog: AnalogModel


class RankResponse(BaseModel):
    target_id: str
    weights_applied: ScoreBreakdown
    ranked_analogs: List[RankedAnalogItem]


class SensorStat(BaseModel):
    mean: float
    max: float
    std_dev: float
    unit: str
    agency_source: str


class DiagnosticTiers(BaseModel):
    match: str
    breakdown: str
    mitigation: str


class RadarVectors(BaseModel):
    target: ScoreBreakdown
    analog: ScoreBreakdown


class DiagnosticsResponse(BaseModel):
    target_id: str
    analog_id: str
    pair_title: str
    scores: ScoreBreakdown
    radar_chart_vectors: RadarVectors
    sensor_stats: Dict[str, SensorStat]
    diagnostics: DiagnosticTiers
