
from pathlib import Path
import time

import pandas as pd
import requests
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
)

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATA_PATH = (
    PROJECT_ROOT
    / "data"
    / "network_ids"
    / "ciciot2023_subset_50000.csv"
)
API_URL = "http://127.0.0.1:8000/network-ids/predict"

df = pd.read_csv(DATA_PATH)

# Sample up to 500 benign and 500 attack rows.
sample_parts = []
for label in [0, 1]:
    group = df[df["is_attack"] == label]
    if not group.empty:
        sample_parts.append(
            group.sample(n=min(500, len(group)), random_state=42)
        )

test_df = pd.concat(sample_parts).sample(frac=1, random_state=42)

metadata = {"Label", "family", "is_attack"}
feature_columns = [c for c in df.columns if c not in metadata]

y_true = []
y_pred = []
errors = []

print(f"Testing {len(test_df)} samples against the API...")

for count, (_, row) in enumerate(test_df.iterrows(), start=1):
    payload = {c: float(row[c]) for c in feature_columns}

    try:
        response = requests.post(API_URL, json=payload, timeout=30)
        response.raise_for_status()
        result = response.json()

        y_true.append(int(row["is_attack"]))
        y_pred.append(int(result["is_attack"]))

    except Exception as exc:
        errors.append(f"Sample {count}: {exc}")

    if count % 100 == 0:
        print(f"Processed {count}/{len(test_df)}")

print("\nSuccessful predictions:", len(y_pred))
print("Failed requests:", len(errors))

if errors:
    print("First errors:", errors[:3])

if y_pred:
    print("Accuracy:", round(accuracy_score(y_true, y_pred), 4))
    print("Confusion matrix (actual rows; predicted columns):")
    print(confusion_matrix(y_true, y_pred, labels=[0, 1]))
    print("\nClassification report:")
    print(
        classification_report(
            y_true,
            y_pred,
            labels=[0, 1],
            target_names=["BENIGN", "ATTACK"],
            zero_division=0,
        )
    )

    results_dir = PROJECT_ROOT / "network_ids" / "results"
    results_dir.mkdir(parents=True, exist_ok=True)

    pd.DataFrame({
        "actual_is_attack": y_true,
        "predicted_is_attack": y_pred,
    }).to_csv(results_dir / "api_batch_predictions.csv", index=False)

    print("Saved predictions to network_ids/results/api_batch_predictions.csv")

