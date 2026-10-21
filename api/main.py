
from pathlib import Path
import random
import sys

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field
from correlation.engine import calculate_cyber_physical_score

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "src"))

from physical_fault_predictor import predict_bearing_fault

app = FastAPI(
    title="CyberPulse Physical Fault API",
    version="1.0.0",
    description="Bearing-fault predictions from engineered vibration features.",
)

# Development configuration for the local React frontend.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


class VibrationFeatures(BaseModel):
    model_config = ConfigDict(extra="forbid")

    max: float = Field(allow_inf_nan=False)
    min: float = Field(allow_inf_nan=False)
    mean: float = Field(allow_inf_nan=False)
    sd: float = Field(ge=0, allow_inf_nan=False)
    rms: float = Field(ge=0, allow_inf_nan=False)
    skewness: float = Field(allow_inf_nan=False)
    kurtosis: float = Field(allow_inf_nan=False)
    crest: float = Field(allow_inf_nan=False)
    form: float = Field(gt=0, allow_inf_nan=False)


@app.get("/health")
def health():
    return {"status": "ok", "service": "physical-fault-api"}



@app.post("/predict")
def predict(features: VibrationFeatures):
    try:
        feature_values = features.model_dump()

        result = predict_bearing_fault(feature_values)

        # Load the same trained model to obtain class probabilities.
        from physical_fault_predictor import load_model

        model = load_model()

        import pandas as pd

        feature_order = [
            "max", "min", "mean", "sd", "rms",
            "skewness", "kurtosis", "crest", "form",
        ]

        sample = pd.DataFrame(
            [[feature_values[name] for name in feature_order]],
            columns=feature_order,
        )

        probabilities = model.predict_proba(sample)[0]
        classes = model.classes_
        predicted_class = str(model.predict(sample)[0])

        class_index = list(classes).index(predicted_class)

        return {
            "predicted_fault": predicted_class,
            "predicted_class_probability": round(
                float(probabilities[class_index]), 4
            ),
            "probability_type": "uncalibrated_model_probability",
        }

    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=422, detail=str(exc))


from pathlib import Path
import pandas as pd
from pydantic import BaseModel, ConfigDict, Field
from fastapi import HTTPException


DATASET_PATH = (
    PROJECT_ROOT / "data" / "feature_time_48k_2048_load_1.csv"
)

FAULT_CLASSES = [
    "Ball_007_1",
    "Ball_014_1",
    "Ball_021_1",
    "IR_007_1",
    "IR_014_1",
    "IR_021_1",
    "Normal_1",
    "OR_007_6_1",
    "OR_014_6_1",
    "OR_021_6_1",
]


class LabelledEvaluationRequest(VibrationFeatures):
    actual_fault: str


@app.post("/evaluate-labelled")
def evaluate_labelled_sample(sample: LabelledEvaluationRequest):
    if sample.actual_fault not in FAULT_CLASSES:
        raise HTTPException(
            status_code=422,
            detail="Unknown actual_fault class.",
        )

    if not DATASET_PATH.exists():
        raise HTTPException(
            status_code=503,
            detail=f"Dataset not found: {DATASET_PATH}",
        )

    try:
        from physical_fault_predictor import load_model

        model = load_model()

        feature_order = [
            "max", "min", "mean", "sd", "rms",
            "skewness", "kurtosis", "crest", "form",
        ]

        values = sample.model_dump(exclude={"actual_fault"})
        row = pd.DataFrame(
            [[values[name] for name in feature_order]],
            columns=feature_order,
        )

        predicted_fault = str(model.predict(row)[0])
        probabilities = model.predict_proba(row)[0]
        classes = list(model.classes_)
        class_index = classes.index(predicted_fault)

        return {
            "actual_fault": sample.actual_fault,
            "predicted_fault": predicted_fault,
            "correct": predicted_fault == sample.actual_fault,
            "predicted_class_probability": round(
                float(probabilities[class_index]), 4
            ),
        }

    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc))


FEATURE_ORDER = [
    "max", "min", "mean", "sd", "rms",
    "skewness", "kurtosis", "crest", "form",
]


def load_labelled_dataset():
    if not DATASET_PATH.exists():
        raise HTTPException(
            status_code=503,
            detail=f"Dataset not found: {DATASET_PATH}",
        )

    dataset = pd.read_csv(DATASET_PATH)

    required_columns = FEATURE_ORDER + ["fault"]
    missing = set(required_columns) - set(dataset.columns)

    if missing:
        raise HTTPException(
            status_code=500,
            detail=f"Dataset is missing columns: {sorted(missing)}",
        )

    return dataset


@app.get("/dataset/classes")
def get_dataset_classes():
    dataset = load_labelled_dataset()

    counts = dataset["fault"].value_counts().sort_index()

    return {
        "classes": [
            {"label": str(label), "count": int(count)}
            for label, count in counts.items()
        ],
        "total_samples": int(len(dataset)),
    }


@app.get("/dataset/sample/{row_index}")
def get_dataset_sample(row_index: int):
    dataset = load_labelled_dataset()

    if row_index < 0 or row_index >= len(dataset):
        raise HTTPException(
            status_code=404,
            detail="Dataset row index is out of range.",
        )

    row = dataset.iloc[row_index]

    return {
        "row_index": int(row_index),
        "actual_fault": str(row["fault"]),
        "features": {
            feature: float(row[feature])
            for feature in FEATURE_ORDER
        },
    }


@app.get("/dataset/random-sample")
def get_random_dataset_sample():
    dataset = load_labelled_dataset()

    row_index = random.randrange(len(dataset))
    row = dataset.iloc[row_index]

    return {
        "row_index": int(row_index),
        "actual_fault": str(row["fault"]),
        "features": {
            feature: float(row[feature])
            for feature in FEATURE_ORDER
        }
    }


from fastapi import Query


@app.get("/dataset/classes/{class_name}/samples")
def get_class_samples(
    class_name: str,
    limit: int = Query(default=20, ge=1, le=100),
):
    dataset = load_labelled_dataset()

    available_classes = set(dataset["fault"].astype(str).unique())

    if class_name not in available_classes:
        raise HTTPException(
            status_code=404,
            detail="Fault class not found.",
        )

    matching = dataset[
        dataset["fault"].astype(str) == class_name
    ].head(limit)

    return {
        "fault_class": class_name,
        "count": int(len(matching)),
        "samples": [
            {
                "row_index": int(index),
                "actual_fault": str(row["fault"]),
                "features": {
                    feature: float(row[feature])
                    for feature in FEATURE_ORDER
                },
            }
            for index, row in matching.iterrows()
        ],
    }


# ---------------- Network IDS API ----------------

import math
import joblib
from functools import lru_cache
from typing import Any

from pydantic import model_validator


NETWORK_IDS_MODEL_PATH = (
    PROJECT_ROOT / "models" / "network_ids_xgboost_tuned.joblib"
)


@lru_cache(maxsize=1)
def load_network_ids_bundle():
    if not NETWORK_IDS_MODEL_PATH.exists():
        raise FileNotFoundError(
            f"Network IDS model not found: {NETWORK_IDS_MODEL_PATH}"
        )

    bundle = joblib.load(NETWORK_IDS_MODEL_PATH)

    required_keys = {"model", "feature_columns", "threshold", "target_mapping"}
    missing = required_keys - set(bundle.keys())

    if missing:
        raise ValueError(
            f"Network IDS model package missing keys: {sorted(missing)}"
        )

    if len(bundle["feature_columns"]) != 37:
        raise ValueError("Expected exactly 37 network input features.")

    return bundle


class NetworkFlowFeatures(BaseModel):
    model_config = ConfigDict(extra="forbid")

    Header_Length: float = Field(allow_inf_nan=False)
    protocol_type: float = Field(alias="Protocol Type", allow_inf_nan=False)
    Time_To_Live: float = Field(allow_inf_nan=False)
    Rate: float = Field(allow_inf_nan=False)
    fin_flag_number: float = Field(allow_inf_nan=False)
    syn_flag_number: float = Field(allow_inf_nan=False)
    rst_flag_number: float = Field(allow_inf_nan=False)
    psh_flag_number: float = Field(allow_inf_nan=False)
    ack_flag_number: float = Field(allow_inf_nan=False)
    ece_flag_number: float = Field(allow_inf_nan=False)
    cwr_flag_number: float = Field(allow_inf_nan=False)
    ack_count: float = Field(allow_inf_nan=False)
    syn_count: float = Field(allow_inf_nan=False)
    fin_count: float = Field(allow_inf_nan=False)
    rst_count: float = Field(allow_inf_nan=False)
    HTTP: float = Field(allow_inf_nan=False)
    HTTPS: float = Field(allow_inf_nan=False)
    DNS: float = Field(allow_inf_nan=False)
    Telnet: float = Field(allow_inf_nan=False)
    SMTP: float = Field(allow_inf_nan=False)
    SSH: float = Field(allow_inf_nan=False)
    IRC: float = Field(allow_inf_nan=False)
    TCP: float = Field(allow_inf_nan=False)
    UDP: float = Field(allow_inf_nan=False)
    DHCP: float = Field(allow_inf_nan=False)
    ARP: float = Field(allow_inf_nan=False)
    ICMP: float = Field(allow_inf_nan=False)
    IGMP: float = Field(allow_inf_nan=False)
    IPv: float = Field(allow_inf_nan=False)
    Tot_sum: float = Field(alias="Tot sum", allow_inf_nan=False)
    Min: float = Field(allow_inf_nan=False)
    Max: float = Field(allow_inf_nan=False)
    AVG: float = Field(allow_inf_nan=False)
    Std: float = Field(allow_inf_nan=False)
    IAT: float = Field(allow_inf_nan=False)
    Number: float = Field(allow_inf_nan=False)
    Variance: float = Field(allow_inf_nan=False)

    @model_validator(mode="after")
    def validate_finite_values(self):
        for name, value in self.model_dump(by_alias=True).items():
            if not math.isfinite(value):
                raise ValueError(f"{name} must be finite.")
        return self


@app.get("/network-ids/health")
def network_ids_health():
    try:
        bundle = load_network_ids_bundle()
        return {
            "status": "ok",
            "service": "network-ids",
            "feature_count": len(bundle["feature_columns"]),
            "threshold": float(bundle["threshold"]),
        }
    except (FileNotFoundError, ValueError) as exc:
        raise HTTPException(status_code=503, detail=str(exc))


@app.post("/network-ids/predict")
def predict_network_flow(features: NetworkFlowFeatures):
    try:
        bundle = load_network_ids_bundle()
        model = bundle["model"]
        feature_columns = bundle["feature_columns"]
        threshold = float(bundle["threshold"])

        values = features.model_dump(by_alias=True)
        missing = set(feature_columns) - set(values)
        extra = set(values) - set(feature_columns)

        if missing or extra:
            raise HTTPException(
                status_code=422,
                detail={
                    "message": "Feature schema mismatch.",
                    "missing_features": sorted(missing),
                    "unexpected_features": sorted(extra),
                },
            )

        import pandas as pd

        sample = pd.DataFrame(
            [[values[name] for name in feature_columns]],
            columns=feature_columns,
        )

        attack_probability = float(model.predict_proba(sample)[0][1])
        prediction = int(attack_probability >= threshold)

        return {
            "prediction": "ATTACK" if prediction == 1 else "BENIGN",
            "is_attack": prediction,
            "attack_probability": round(attack_probability, 6),
            "threshold": threshold,
            "probability_type": "uncalibrated_model_probability",
            "model": "XGBoost",
        }

    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except HTTPException:
        raise
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=422, detail=str(exc))


# ---------------- Network IDS Dataset Samples ----------------

NETWORK_IDS_DATASET_PATH = (
    PROJECT_ROOT
    / "data"
    / "network_ids"
    / "ciciot2023_subset_50000.csv"
)


@lru_cache(maxsize=1)
def load_network_ids_dataset():
    if not NETWORK_IDS_DATASET_PATH.exists():
        raise FileNotFoundError(
            f"Network IDS dataset not found: {NETWORK_IDS_DATASET_PATH}"
        )

    dataset = pd.read_csv(NETWORK_IDS_DATASET_PATH)

    required_columns = {
        "Label",
        "family",
        "is_attack",
    }

    if not required_columns.issubset(dataset.columns):
        raise ValueError("Dataset is missing required label columns.")

    bundle = load_network_ids_bundle()
    feature_columns = bundle["feature_columns"]

    missing_features = set(feature_columns) - set(dataset.columns)
    if missing_features:
        raise ValueError(
            f"Dataset is missing model features: {sorted(missing_features)}"
        )

    return dataset


def format_network_ids_sample(row_index: int):
    dataset = load_network_ids_dataset()
    bundle = load_network_ids_bundle()

    if row_index < 0 or row_index >= len(dataset):
        raise HTTPException(
            status_code=404,
            detail=f"Dataset row index must be between 0 and {len(dataset) - 1}.",
        )

    row = dataset.iloc[row_index]
    feature_columns = bundle["feature_columns"]

    features = {}
    for column in feature_columns:
        value = row[column]

        if pd.isna(value):
            raise HTTPException(
                status_code=422,
                detail=f"Dataset row {row_index} contains a missing value in {column}.",
            )

        features[column] = float(value)

    return {
        "row_index": row_index,
        "features": features,
        "label": str(row["Label"]),
        "family": str(row["family"]),
        "is_attack": int(row["is_attack"]),
    }


@app.get("/network-ids/dataset/sample/{row_index}")
def get_network_ids_dataset_sample(row_index: int):
    try:
        return format_network_ids_sample(row_index)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/network-ids/dataset/random-sample")
def get_random_network_ids_dataset_sample():
    try:
        dataset = load_network_ids_dataset()
        row_index = random.randrange(len(dataset))
        return format_network_ids_sample(row_index)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=500, detail=str(exc))


class CorrelationRequest(BaseModel):
    network_prediction: str
    attack_probability: float = Field(ge=0.0, le=1.0)
    physical_fault: str
    physical_probability: float = Field(ge=0.0, le=1.0)
    temporal_correlation: float = Field(default=0.0, ge=0.0, le=1.0)


@app.post("/correlation/analyze")
def analyze_correlation(request: CorrelationRequest):
    try:
        return calculate_cyber_physical_score(
            network_prediction=request.network_prediction,
            attack_probability=request.attack_probability,
            physical_fault=request.physical_fault,
            physical_probability=request.physical_probability,
            temporal_correlation=request.temporal_correlation,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
