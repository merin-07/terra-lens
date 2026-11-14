import json
from pathlib import Path
from typing import Dict, List, Optional
from fastapi import HTTPException
from . import schemas

DATA_DIR = Path(__file__).resolve().parent / "data"

_targets_cache: Optional[Dict] = None
_analogs_cache: Optional[Dict] = None
_metrics_cache: Optional[Dict] = None


def load_json(filename: str) -> dict:
    filepath = DATA_DIR / filename
    if not filepath.exists():
        raise FileNotFoundError(f"Data file not found: {filepath}")
    with open(filepath, "r", encoding="utf-8") as f:
        return json.load(f)


def get_targets_data() -> dict:
    global _targets_cache
    if _targets_cache is None:
        _targets_cache = load_json("targets.json")
    return _targets_cache


def get_analogs_data() -> dict:
    global _analogs_cache
    if _analogs_cache is None:
        _analogs_cache = load_json("analogs.json")
    return _analogs_cache


def get_metrics_data() -> dict:
    global _metrics_cache
    if _metrics_cache is None:
        _metrics_cache = load_json("comparison_metrics.json")
    return _metrics_cache


def list_targets() -> List[schemas.TargetModel]:
    data = get_targets_data()
    return [schemas.TargetModel(**item) for item in data.get("planetary_targets", [])]


def get_target(target_id: str) -> schemas.TargetModel:
    targets = list_targets()
    for t in targets:
        if t.id.lower() == target_id.lower():
            return t
    raise HTTPException(status_code=404, detail=f"Target '{target_id}' not found.")


def list_analogs() -> List[schemas.AnalogModel]:
    data = get_analogs_data()
    return [schemas.AnalogModel(**item) for item in data.get("earth_analogs", [])]


def get_analog(analog_id: str) -> schemas.AnalogModel:
    analogs = list_analogs()
    for a in analogs:
        if a.id.lower() == analog_id.lower():
            return a
    raise HTTPException(status_code=404, detail=f"Earth analog '{analog_id}' not found.")


def get_diagnostics(target_id: str, analog_id: str) -> schemas.DiagnosticsResponse:
    # Ensure both target and analog exist
    get_target(target_id)
    get_analog(analog_id)

    metrics_data = get_metrics_data().get("comparison_metrics", {})
    key = f"{target_id.lower()}_{analog_id.lower()}"
    pair_data = metrics_data.get(key)

    if not pair_data:
        raise HTTPException(
            status_code=404,
            detail=f"Diagnostics not found for pair ({target_id}, {analog_id})."
        )

    return schemas.DiagnosticsResponse(**pair_data)


def rank_analogs(request: schemas.RankRequest) -> schemas.RankResponse:
    target = get_target(request.target_id)
    analogs = list_analogs()
    metrics_data = get_metrics_data().get("comparison_metrics", {})

    # 1. Normalize weights
    raw_weights = request.weights
    w_slope = max(0.0, float(raw_weights.slope))
    w_radar = max(0.0, float(raw_weights.radar_roughness))
    w_thermal = max(0.0, float(raw_weights.thermal))
    w_geochem = max(0.0, float(raw_weights.geochemical))

    total_weight = w_slope + w_radar + w_thermal + w_geochem

    # Safe fallback if all weights are zero
    if total_weight <= 1e-6:
        nw_slope = 0.25
        nw_radar = 0.25
        nw_thermal = 0.25
        nw_geochem = 0.25
    else:
        nw_slope = w_slope / total_weight
        nw_radar = w_radar / total_weight
        nw_thermal = w_thermal / total_weight
        nw_geochem = w_geochem / total_weight

    norm_weights = schemas.ScoreBreakdown(
        slope=round(nw_slope, 4),
        radar_roughness=round(nw_radar, 4),
        thermal=round(nw_thermal, 4),
        geochemical=round(nw_geochem, 4)
    )

    # 2. Compute composite scores
    ranked_items: List[schemas.RankedAnalogItem] = []

    for analog in analogs:
        key = f"{target.id.lower()}_{analog.id.lower()}"
        pair_data = metrics_data.get(key)

        if pair_data:
            s_data = pair_data.get("scores", {})
            m_slope = float(s_data.get("slope", 50.0))
            m_radar = float(s_data.get("radar_roughness", 50.0))
            m_thermal = float(s_data.get("thermal", 50.0))
            m_geochem = float(s_data.get("geochemical", 50.0))
        else:
            # Baseline estimation if metric missing
            m_slope = 50.0
            m_radar = 50.0
            m_thermal = 50.0
            m_geochem = 50.0

        scores = schemas.ScoreBreakdown(
            slope=round(m_slope, 1),
            radar_roughness=round(m_radar, 1),
            thermal=round(m_thermal, 1),
            geochemical=round(m_geochem, 1)
        )

        composite = (
            nw_slope * m_slope +
            nw_radar * m_radar +
            nw_thermal * m_thermal +
            nw_geochem * m_geochem
        )

        item = schemas.RankedAnalogItem(
            rank=0,  # will set after sorting
            analog_id=analog.id,
            name=analog.name,
            region=analog.region,
            country=analog.country,
            coordinates=analog.coordinates,
            composite_score=round(composite, 1),
            scores=scores,
            normalized_weights=norm_weights,
            analog=analog
        )
        ranked_items.append(item)

    # 3. Sort descending by composite score
    ranked_items.sort(key=lambda x: x.composite_score, reverse=True)

    # Assign 1-based ranks
    for idx, item in enumerate(ranked_items):
        item.rank = idx + 1

    return schemas.RankResponse(
        target_id=target.id,
        weights_applied=norm_weights,
        ranked_analogs=ranked_items
    )
