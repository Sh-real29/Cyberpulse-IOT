
from pathlib import Path

import joblib
import pandas as pd
from xgboost import XGBClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
    classification_report,
    confusion_matrix,
)

ROOT = Path(__file__).resolve().parents[2]
DATA_PATH = ROOT / "data" / "network_ids" / "ciciot2023_subset_50000.csv"
MODEL_DIR = ROOT / "models"
RESULTS_DIR = ROOT / "network_ids" / "results"

def main():
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)

    print("Loading network IDS dataset...")
    df = pd.read_csv(DATA_PATH)

    X = df.drop(columns=["Label", "family", "is_attack"])
    y = df["is_attack"].astype(int)

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.20,
        random_state=42,
        stratify=y,
    )

    print(f"Training rows: {len(X_train):,}")
    print(f"Testing rows: {len(X_test):,}")
    print(f"Input features: {X.shape[1]}")

    # ATTACK is class 1; compensate for its majority/minority
    # relationship only after checking class counts.
    benign_count = int((y_train == 0).sum())
    attack_count = int((y_train == 1).sum())
    print(f"Training benign samples: {benign_count:,}")
    print(f"Training attack samples: {attack_count:,}")

    # Initial unweighted model: use as a clean baseline first.
    model = XGBClassifier(
        n_estimators=300,
        max_depth=6,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        objective="binary:logistic",
        eval_metric="logloss",
        random_state=42,
        n_jobs=-1,
        tree_method="hist",
    )

    print("\nTraining XGBoost...")
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

    print("\n=== XGBoost IDS Evaluation ===")
    for name, value in metrics.items():
        print(f"{name}: {value:.4f}")

    print("\nClassification report:")
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
    matrix_df.to_csv(RESULTS_DIR / "xgboost_ids_confusion_matrix.csv")

    pd.DataFrame([metrics]).to_csv(
        RESULTS_DIR / "xgboost_ids_metrics.csv", index=False
    )

    model_path = MODEL_DIR / "network_ids_xgboost.joblib"
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
