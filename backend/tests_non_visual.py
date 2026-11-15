"""
=============================================================================
TERRA-LENS EXPEDITION SYSTEMS — SCIENTIFIC BACKEND TEST HARNESS
Automated Non-Visual Verification Suite for Multi-Sensor Catalog & Diagnostics
=============================================================================
"""

import sys
from pathlib import Path

# Add project root to sys.path
WORKSPACE_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(WORKSPACE_ROOT))

from backend import main, schemas, services


def test_root_and_health():
    print("--- 1. Testing GET / & GET /health ---")
    home_res = main.home()
    assert home_res["status"] == "online"
    assert "version" in home_res
    assert "/targets" in home_res["endpoints"]
    assert "/rank-analogs" in home_res["endpoints"]
    print("  ✓ GET / -> Nominal online status")

    health_res = main.health()
    assert health_res["status"] == "healthy"
    assert health_res["subsystems"]["catalog"] == "nominal"
    assert health_res["subsystems"]["scoring_engine"] == "nominal"
    assert health_res["subsystems"]["diagnostics"] == "nominal"
    print("  ✓ GET /health -> Subsystems nominal")


def test_targets_catalog():
    print("\n--- 2. Testing Targets Catalog & Layer Schema Integrity ---")
    targets = main.get_targets()
    assert len(targets) == 2, f"Expected 2 planetary targets, got {len(targets)}"
    target_ids = {t.id for t in targets}
    assert target_ids == {"shackleton", "jezero"}

    required_layers = ["optical", "sar", "thermal", "slope"]
    for t in targets:
        assert isinstance(t, schemas.TargetModel)
        assert t.body in ["Moon", "Mars"]
        assert len(t.coordinates) > 3
        for layer_key in required_layers:
            assert layer_key in t.layers, f"Target {t.id} missing layer {layer_key}"
            layer = t.layers[layer_key]
            assert isinstance(layer, schemas.LayerInfo)
            assert len(layer.agency) > 2
            assert len(layer.path) > 3
            assert len(layer.resolution) > 1
        # Check baseline profile
        assert t.baseline_profile.slope > 0
        assert t.baseline_profile.radar_roughness > 0
        assert t.baseline_profile.thermal > 0
        assert t.baseline_profile.geochemical > 0
    print(f"  ✓ Validated 2 planetary targets ({list(target_ids)}) with all 4 sensor bands")


def test_analogs_catalog():
    print("\n--- 3. Testing Earth Analogs Catalog Integrity ---")
    analogs = main.get_analogs()
    assert len(analogs) == 5, f"Expected 5 Earth analogs, got {len(analogs)}"
    expected_ids = {"tablelands", "harrat-khaybar", "sredinny", "tuktoyaktuk", "lut-desert"}
    analog_ids = {a.id for a in analogs}
    assert analog_ids == expected_ids, f"Mismatch in analog IDs: {analog_ids} vs {expected_ids}"

    required_layers = ["optical", "sar", "thermal", "slope"]
    for a in analogs:
        assert isinstance(a, schemas.AnalogModel)
        assert len(a.region) > 2
        assert len(a.coordinates) > 3
        assert len(a.geologic_context) > 10
        for layer_key in required_layers:
            assert layer_key in a.layers, f"Analog {a.id} missing layer {layer_key}"
            layer = a.layers[layer_key]
            assert isinstance(layer, schemas.LayerInfo)
            assert len(layer.agency) > 2
            assert len(layer.path) > 3
    print(f"  ✓ Validated 5 Earth analogs ({list(analog_ids)}) across all terrain metadata")


def test_diagnostics_all_pairs():
    print("\n--- 4. Testing Diagnostics Matrix (All 10 Target–Analog Pairs) ---")
    targets = ["shackleton", "jezero"]
    analogs = ["tablelands", "harrat-khaybar", "sredinny", "tuktoyaktuk", "lut-desert"]
    required_sensors = ["optical", "sar", "thermal", "slope"]

    pair_count = 0
    for t_id in targets:
        for a_id in analogs:
            diag = main.get_diagnostics(t_id, a_id)
            assert isinstance(diag, schemas.DiagnosticsResponse)
            assert diag.target_id == t_id
            assert diag.analog_id == a_id

            # Scores validation (0-100 range)
            for metric in ["slope", "radar_roughness", "thermal", "geochemical"]:
                val = getattr(diag.scores, metric)
                assert 0 <= val <= 100, f"Score {metric}={val} out of bounds for ({t_id}, {a_id})"

            # Radar chart vectors
            assert diag.radar_chart_vectors.target is not None
            assert diag.radar_chart_vectors.analog is not None

            # Sensor stats
            for s_key in required_sensors:
                assert s_key in diag.sensor_stats, f"Missing {s_key} in sensor_stats for ({t_id}, {a_id})"
                st = diag.sensor_stats[s_key]
                assert isinstance(st, schemas.SensorStat)
                assert st.mean != 0.0 or st.max != 0.0
                assert len(st.unit) > 0
                assert len(st.agency_source) > 2

            # 3-Tier diagnostic assessments
            assert len(diag.diagnostics.match) >= 15, "Tier 1 Match diagnostic text too brief"
            assert len(diag.diagnostics.breakdown) >= 15, "Tier 2 Breakdown diagnostic text too brief"
            assert len(diag.diagnostics.mitigation) >= 15, "Tier 3 Mitigation protocol text too brief"

            pair_count += 1

    print(f"  ✓ Successfully verified complete scientific telemetry across all {pair_count} Target–Analog pairs")


def test_diagnostics_404_error_handling():
    print("\n--- 5. Testing Diagnostics 404 Guardrails ---")
    invalid_cases = [
        ("invalid_target", "tablelands"),
        ("shackleton", "invalid_analog"),
        ("europa", "atacama"),
    ]
    for t_id, a_id in invalid_cases:
        try:
            main.get_diagnostics(t_id, a_id)
            assert False, f"Should have raised 404 for ({t_id}, {a_id})"
        except Exception as e:
            assert getattr(e, "status_code", None) == 404, f"Expected status_code 404, got {e}"
    print("  ✓ Correctly rejected invalid target and analog IDs with HTTP 404")


def test_weight_normalization_edge_cases():
    print("\n--- 6. Testing Weight Normalization Edge Cases ---")

    # Case A: All Zeroes -> Equal 25% distribution
    res_zero = main.rank_analogs(schemas.RankRequest(
        target_id="shackleton",
        weights=schemas.WeightsInput(slope=0.0, radar_roughness=0.0, thermal=0.0, geochemical=0.0)
    ))
    nw_zero = res_zero.weights_applied
    assert nw_zero.slope == 0.25
    assert nw_zero.radar_roughness == 0.25
    assert nw_zero.thermal == 0.25
    assert nw_zero.geochemical == 0.25
    print("  ✓ Case A: All zeroes -> Safely normalized to 0.25 equal weights")

    # Case B: Single 100% Dominant Weight
    res_single = main.rank_analogs(schemas.RankRequest(
        target_id="shackleton",
        weights=schemas.WeightsInput(slope=100.0, radar_roughness=0.0, thermal=0.0, geochemical=0.0)
    ))
    nw_single = res_single.weights_applied
    assert nw_single.slope == 1.0
    assert nw_single.radar_roughness == 0.0
    assert nw_single.thermal == 0.0
    assert nw_single.geochemical == 0.0
    # Top analog for 100% slope on shackleton should match highest slope score
    top_slope_analog = res_single.ranked_analogs[0]
    assert top_slope_analog.composite_score == top_slope_analog.scores.slope
    print(f"  ✓ Case B: Single 100% slope weight -> Normalized to 1.0, top analog: {top_slope_analog.name} ({top_slope_analog.composite_score}%)")

    # Case C: Skewed Floats
    res_skewed = main.rank_analogs(schemas.RankRequest(
        target_id="jezero",
        weights=schemas.WeightsInput(slope=33.3, radar_roughness=66.7, thermal=0.0, geochemical=0.0)
    ))
    nw_skewed = res_skewed.weights_applied
    sum_weights = nw_skewed.slope + nw_skewed.radar_roughness + nw_skewed.thermal + nw_skewed.geochemical
    assert abs(sum_weights - 1.0) < 0.001
    print(f"  ✓ Case C: Skewed floats -> Sum of normalized weights = {sum_weights:.4f}")

    # Case D: Negative Guardrails (Negative values clamped to 0)
    res_neg = main.rank_analogs(schemas.RankRequest(
        target_id="jezero",
        weights=schemas.WeightsInput(slope=-50.0, radar_roughness=50.0, thermal=50.0, geochemical=-10.0)
    ))
    nw_neg = res_neg.weights_applied
    assert nw_neg.slope == 0.0
    assert nw_neg.geochemical == 0.0
    assert nw_neg.radar_roughness == 0.5
    assert nw_neg.thermal == 0.5
    print("  ✓ Case D: Negative weights -> Clamped to 0.0 with positive split evenly")


def test_mission_presets_deterministic_ranking():
    print("\n--- 7. Testing Deterministic Ranking for All 3 Mission Presets ---")

    presets = [
        {
            "id": "mobility",
            "name": "Polar Rover Mobility",
            "weights": schemas.WeightsInput(slope=50.0, radar_roughness=30.0, thermal=10.0, geochemical=10.0),
        },
        {
            "id": "cryo_drill",
            "name": "Subsurface Cryo-Drill",
            "weights": schemas.WeightsInput(slope=10.0, radar_roughness=40.0, thermal=40.0, geochemical=10.0),
        },
        {
            "id": "isru",
            "name": "ISRU & Dust Filtration",
            "weights": schemas.WeightsInput(slope=10.0, radar_roughness=15.0, thermal=25.0, geochemical=50.0),
        },
    ]

    for target_id in ["shackleton", "jezero"]:
        print(f"\n  Evaluating Target: [{target_id.upper()}]")
        for preset in presets:
            req = schemas.RankRequest(target_id=target_id, weights=preset["weights"])
            rank_res = main.rank_analogs(req)
            assert len(rank_res.ranked_analogs) == 5

            # Verify 1-based ranks and strict descending order
            scores = []
            for i, item in enumerate(rank_res.ranked_analogs):
                assert item.rank == i + 1
                scores.append(item.composite_score)
                # Verify mathematical calculation
                nw = rank_res.weights_applied
                expected_score = round(
                    nw.slope * item.scores.slope +
                    nw.radar_roughness * item.scores.radar_roughness +
                    nw.thermal * item.scores.thermal +
                    nw.geochemical * item.scores.geochemical,
                    1
                )
                assert abs(item.composite_score - expected_score) <= 0.1, (
                    f"Calculation mismatch for {item.name}: {item.composite_score} vs {expected_score}"
                )

            assert scores == sorted(scores, reverse=True), f"Ranking not sorted descending for {preset['name']}"
            top_candidate = rank_res.ranked_analogs[0]
            print(f"    • {preset['name']}: #1 Candidate is {top_candidate.name} ({top_candidate.composite_score}%)")


def run_all_tests():
    print("==================================================================")
    print("STARTING TERRA-LENS EXPEDITION BACKEND NON-VISUAL TEST HARNESS")
    print("==================================================================")
    test_root_and_health()
    test_targets_catalog()
    test_analogs_catalog()
    test_diagnostics_all_pairs()
    test_diagnostics_404_error_handling()
    test_weight_normalization_edge_cases()
    test_mission_presets_deterministic_ranking()
    print("\n==================================================================")
    print("ALL 7 ADVANCED BACKEND TEST SUITES COMPLETED WITH 100% PASS RATE!")
    print("==================================================================")


if __name__ == "__main__":
    run_all_tests()
