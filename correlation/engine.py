
from typing import Any


def calculate_cyber_physical_score(
    network_prediction: str,
    attack_probability: float,
    physical_fault: str,
    physical_probability: float,
    temporal_correlation: float = 0.0,
) -> dict[str, Any]:
    """
    Calculate a transparent prototype cyber-physical risk score.

    Inputs:
      network_prediction: "ATTACK" or "BENIGN"
      attack_probability: model output in [0, 1]
      physical_fault: predicted physical class, e.g. "Normal_1"
      physical_probability: predicted-class probability in [0, 1]
      temporal_correlation: manually supplied temporal evidence in [0, 1]

    This is a heuristic prototype, not a trained or calibrated risk model.
    """

    if network_prediction.upper() not in {"ATTACK", "BENIGN"}:
        raise ValueError("network_prediction must be ATTACK or BENIGN")

    for name, value in (
        ("attack_probability", attack_probability),
        ("physical_probability", physical_probability),
        ("temporal_correlation", temporal_correlation),
    ):
        if not 0.0 <= value <= 1.0:
            raise ValueError(f"{name} must be between 0 and 1")

    is_attack = network_prediction.upper() == "ATTACK"
    is_physical_anomaly = not (
        physical_fault.lower() == "normal_1"
        or physical_fault.lower().startswith("normal")
    )

    network_risk = attack_probability if is_attack else 0.0
    physical_risk = physical_probability if is_physical_anomaly else 0.0

    # Initial transparent weighting for prototype testing only.
    score = round(
        100
        * (
            0.4 * network_risk
            + 0.4 * physical_risk
            + 0.2 * temporal_correlation
        )
    )
    score = max(0, min(100, score))

    if score >= 70:
        risk_level = "HIGH"
    elif score >= 40:
        risk_level = "MODERATE"
    else:
        risk_level = "LOW"

    signals = []
    if is_attack:
        signals.append("Network IDS classified the traffic as an attack")
    if is_physical_anomaly:
        signals.append(f"Physical model detected {physical_fault}")
    if temporal_correlation > 0:
        signals.append("Temporal correlation evidence was supplied")
    if not signals:
        signals.append("No positive attack or physical-anomaly indicators")

    return {
        "cyber_physical_score": score,
        "risk_level": risk_level,
        "network_risk": round(network_risk, 4),
        "physical_risk": round(physical_risk, 4),
        "temporal_correlation": round(temporal_correlation, 4),
        "network_is_attack": is_attack,
        "physical_is_anomaly": is_physical_anomaly,
        "signals": signals,
        "model_type": "prototype_heuristic",
        "warning": (
            "Experimental score; not calibrated, not a probability, "
            "and not proof that a cyberattack caused a physical anomaly."
        ),
    }
