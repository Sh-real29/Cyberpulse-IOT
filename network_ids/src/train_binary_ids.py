
from pathlib import Path

import joblib
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)

from sklearn.model_selection import train_test_split

ROOT = Path(__file__).resolve().parents[2]
DATA_PATH = ROOT / "data" / "network_ids" / "ciciot2023_subset_50000.csv"
MODEL_DIR = ROOT / "models"
RESULTS_DIR = ROOT / "network_ids" / "results"

TARGET = "is_attack"
DROP_COLUMNS = ["Label", "family", TARGET]

def main():
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)

    print("Loading network IDS dataset...")
    df = pd.read_csv(DATA_PATH)

    # Keep the target separate from model inputs.
    X = df.drop(columns=DROP_COLUMNS)
    y = df[TARGET].astype(int)

    if y.nunique() != 2:
        raise ValueError(f"Expected binary target, found: {y.unique()}")

    # Stratified split keeps the benign/attack proportions similar.
    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.20,
        random_state=42,
        stratify=y,
    )

    print(f"Training rows: {len(X_train):,}")
    print(f"Testing rows:  {len(X_test):,}")
    print(f"Input features: {X.shape[1]}")

    model = RandomForestClassifier(
        n_estimators=200,
        class_weight="balanced",
        random_state=42,
        n_jobs=-1,
    )

    print("\nTraining Random Forest...")
    model.fit(X_train, y_train)

    predictions = model.predict(X_test)
    probabilities = model.predict_proba(X_test)[:, 1]

    metrics = {
        "accuracy": accuracy_score(y_test, predictions),
        "precision_attack": precision_score(
            y_test, predictions, zero_division=0
        ),
        "recall_attack": recall_score(
            y_test, predictions, zero_division=0
        ),
        "f1_attack": f1_score(
            y_test, predictions, zero_division=0
        ),
        "roc_auc": roc_auc_score(y_test, probabilities),
    }

    print("\n=== Binary IDS Evaluation ===")
    for name, value in metrics.items():
        print(f"{name}: {value:.4f}")

    print("\nClassification report:")
    report = classification_report(
        y_test,
        predictions,
        labels=[0, 1],
        target_names=["BENIGN", "ATTACK"],
        zero_division=0,
        output_dict=True,
    )
    print(classification_report(
        y_test,
        predictions,
        labels=[0, 1],
        target_names=["BENIGN", "ATTACK"],
        zero_division=0,
    ))

    matrix = confusion_matrix(y_test, predictions, labels=[0, 1])
    matrix_df = pd.DataFrame(
        matrix,
        index=["Actual_BENIGN", "Actual_ATTACK"],
        columns=["Predicted_BENIGN", "Predicted_ATTACK"],
    )
    matrix_df.to_csv(RESULTS_DIR / "binary_ids_confusion_matrix.csv")

    pd.DataFrame([metrics]).to_csv(
        RESULTS_DIR / "binary_ids_metrics.csv", index=False
    )
    pd.DataFrame(report).transpose().to_csv(
        RESULTS_DIR / "binary_ids_classification_report.csv"
    )

    model_path = MODEL_DIR / "network_ids_random_forest.joblib"
    joblib.dump(
        {
            "model": model,
            "feature_columns": X.columns.tolist(),
            "target_mapping": {0: "BENIGN", 1: "ATTACK"},
        },
        model_path,
    )

    print(f"\nModel saved to: {model_path}")
    print(f"Results saved to: {RESULTS_DIR}")

if __name__ == "__main__":
    main()
