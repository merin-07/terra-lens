import sys
from pathlib import Path

# Add project root to sys.path
WORKSPACE_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(WORKSPACE_ROOT))

from backend import main, schemas, services

def run_tests():
    print("--- 1. Testing GET / (home) ---")
    home_res = main.home()
    assert home_res["status"] == "online" or home_res.get("service") == "Planetary Analog Discovery Engine"
    print("home() -> OK:", home_res)

    print("\n--- 2. Testing GET /health ---")
    health_res = main.health()
    assert health_res["status"] == "healthy"
    print("health() -> OK:", health_res)

    print("\n--- 3. Testing GET /targets ---")
    targets = main.get_targets()
    assert len(targets) == 2, f"Expected 2 targets, got {len(targets)}"
    target_ids = {t.id for t in targets}
    assert target_ids == {"shackleton", "jezero"}
    for t in targets:
        assert isinstance(t, schemas.TargetModel)
        assert all(k in t.layers for k in ["optical", "sar", "thermal", "slope"])
    print(f"get_targets() -> OK ({len(targets)} targets verified: {list(target_ids)})")

    print("\n--- 4. Testing GET /analogs ---")
    analogs = main.get_analogs()
    assert len(analogs) == 5, f"Expected 5 analogs, got {len(analogs)}"
    expected_ids = {"tablelands", "harrat-khaybar", "sredinny", "tuktoyaktuk", "lut-desert"}
    analog_ids = {a.id for a in analogs}
    assert analog_ids == expected_ids
    for a in analogs:
        assert isinstance(a, schemas.AnalogModel)
        assert all(k in a.layers for k in ["optical", "sar", "thermal", "slope"])
    print(f"get_analogs() -> OK ({len(analogs)} analogs verified: {list(analog_ids)})")

    print("\n--- 5. Testing GET /diagnostics/{target_id}/{analog_id} (All 10 pairs) ---")
    for t in ["shackleton", "jezero"]:
        for a in expected_ids:
            diag = main.get_diagnostics(t, a)
            assert isinstance(diag, schemas.DiagnosticsResponse)
            assert diag.target_id == t
            assert diag.analog_id == a
            assert diag.scores.slope > 0
            assert diag.scores.radar_roughness > 0
            assert diag.scores.thermal > 0
            assert diag.scores.geochemical > 0
            assert all(k in diag.sensor_stats for k in ["optical", "sar", "thermal", "slope"])
            assert len(diag.diagnostics.match) > 10
            assert len(diag.diagnostics.breakdown) > 10
            assert len(diag.diagnostics.mitigation) > 10
    print("get_diagnostics() -> All 10 pairs verified with complete Pydantic response models, sensor stats & diagnostics")

    # 404 test
    try:
        main.get_diagnostics("unknown_target", "unknown_analog")
        assert False, "Should have raised 404 HTTPException"
    except Exception as e:
        assert getattr(e, "status_code", None) == 404
        print("get_diagnostics(invalid) -> Correctly raised 404 HTTPException")

    print("\n--- 6. Testing POST /rank-analogs (Custom Weights) ---")
    req = schemas.RankRequest(
        target_id="shackleton",
        weights=schemas.WeightsInput(
            slope=50.0,
            radar_roughness=30.0,
            thermal=10.0,
            geochemical=10.0,
        )
    )
    rank_res = main.rank_analogs(req)
    assert isinstance(rank_res, schemas.RankResponse)
    assert rank_res.target_id == "shackleton"
    assert len(rank_res.ranked_analogs) == 5
    assert rank_res.weights_applied.slope == 0.5
    scores = [item.composite_score for item in rank_res.ranked_analogs]
    assert scores == sorted(scores, reverse=True), "Ranked list not sorted descending!"
    print("rank_analogs(custom) -> OK. Normalized weights:", rank_res.weights_applied.model_dump())
    for item in rank_res.ranked_analogs:
        print(f"  #{item.rank} {item.name}: {item.composite_score}% (Scores: {item.scores.model_dump()})")

    print("\n--- 7. Testing POST /rank-analogs (Zero Weights Safe Normalization) ---")
    zero_req = schemas.RankRequest(
        target_id="jezero",
        weights=schemas.WeightsInput(
            slope=0.0,
            radar_roughness=0.0,
            thermal=0.0,
            geochemical=0.0,
        )
    )
    zero_res = main.rank_analogs(zero_req)
    assert isinstance(zero_res, schemas.RankResponse)
    assert zero_res.weights_applied.slope == 0.25
    assert zero_res.weights_applied.radar_roughness == 0.25
    assert zero_res.weights_applied.thermal == 0.25
    assert zero_res.weights_applied.geochemical == 0.25
    print("rank_analogs(zero_weights) -> OK. Normalized safely to 0.25 equal weights.")

    print("\n==========================================")
    print("ALL 7 BACKEND NON-VISUAL TESTS PASSED!")
    print("==========================================")

if __name__ == "__main__":
    run_tests()
