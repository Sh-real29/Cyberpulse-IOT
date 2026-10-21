
from pathlib import Path

import joblib
import pandas as pd


PROJECT_ROOT = Path(__file__).resolve().parents[1]
MODEL_PATH = (
    PROJECT_ROOT
    / "models"
    / "physical_fault_random_forest.joblib"
)

FEATURES = [
    "max",
    "min",
    "mean",
    "sd",
    "rms",
    "skewness",
    "kurtosis",
    "crest",
    "form",
]


def load_model():
    """Load the saved physical fault-detection model."""
    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            f"Model not found: {MODEL_PATH}. "
            "Run the training notebook and save the model first."
        )

    return joblib.load(MODEL_PATH)


def predict_bearing_fault(feature_values):
    """
    Predict one of the ten bearing-fault classes.

    Args:
        feature_values: Dictionary containing all nine
            engineered vibration features.

    Returns:
        Dictionary containing the predicted fault class.
    """
    if not isinstance(feature_values, dict):
        raise TypeError("feature_values must be a dictionary.")

    missing = set(FEATURES) - set(feature_values)
    extra = set(feature_values) - set(FEATURES)

    if missing or extra:
        raise ValueError(
            f"Missing features: {sorted(missing)}; "
            f"unexpected features: {sorted(extra)}"
        )

    row = pd.DataFrame(
        [[feature_values[name] for name in FEATURES]],
        columns=FEATURES,
    )

    if row.isna().any().any():
        raise ValueError("Features must not contain missing values.")

    if not all(
        pd.api.types.is_numeric_dtype(row[column])
        for column in FEATURES
    ):
        raise ValueError("All features must be numeric.")

    if not all(
        row[column].map(lambda value: __import__("math").isfinite(value)).all()
        for column in FEATURES
    ):
        raise ValueError("Features must contain finite numeric values.")

    model = load_model()
    prediction = str(model.predict(row)[0])

    return {"predicted_fault": prediction}
