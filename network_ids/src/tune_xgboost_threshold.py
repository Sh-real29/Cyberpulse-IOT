
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
    confusion_matrix,
    classification_report,
    roc_auc_score,
)

ROOT = Path(__file__).resolve().parents[2]
DATA_PATH = ROOT / "data" / "network_ids" / "ciciot2023_subset_50000.csv"
MODEL_DIR = ROOT / "models"
RESULTS_DIR = ROOT / "network_ids" / "results"


def calculate_metrics(y_true, probabilities, threshold):
    predictions = (probabilities >= threshold).astype(int)

    tn, fp, fn, tp = confusion_matrix(
        y_true, predictions, labels=[0, 1]
    ).ravel()

    return {
        "threshold": threshold,
        "accuracy": accuracy_score(y_true, predictions),
        "attack_precision": precision_score(
            y_true, predictions, zero_division=0
        ),
        "attack_recall": recall_score(
            y_true, predictions, zero_division=0
        ),
        "attack_f1": f1_score(
            y_true, predictions, zero_division=0
        ),
        "benign_recall": tn / (tn + fp) if tn + fp else 0.0,
        "false_positive_rate": fp / (fp + tn) if fp + tn else 0.0,
        "false_negatives": int(fn),
        "false_positives": int(fp),
        "true_negatives": int(tn),
        "true_positives": int(tp),
        "roc_auc": roc_auc_score(y_true, probabilities),
    }


def main():
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)

    print("Loading dataset...")
    df = pd.read_csv(DATA_PATH)

    X = df.drop(columns=["Label", "family", "is_attack"])
    y = df["is_attack"].astype(int)

    # 60% train, 20% validation, 20% final test.
    X_train, X_temp, y_train, y_temp = train_test_split(
        X, y,
        test_size=0.40,
        random_state=42,
        stratify=y,
    )

    X_val, X_test, y_val, y_test = train_test_split(
        X_temp, y_temp,
        test_size=0.50,
        random_state=42,
        stratify=y_temp,
    )

    print(
        f"Train: {len(X_train):,} | "
        f"Validation: {len(X_val):,} | "
        f"Test: {len(X_test):,}"
    )

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

    # Select threshold using validation data only.
    val_probabilities = model.predict_proba(X_val)[:, 1]
    thresholds = [0.10, 0.20, 0.30, 0.40, 0.50, 0.60, 0.70, 0.80, 0.90]

    val_results = pd.DataFrame([
        calculate_metrics(y_val, val_probabilities, t)
        for t in thresholds
    ])

    val_results.to_csv(
        RESULTS_DIR / "xgboost_threshold_validation.csv",
        index=False,
    )

    # Choose the threshold with the best benign recall,
    # subject to at least 98% attack recall on validation.
    eligible = val_results[val_results["attack_recall"] >= 0.98]

    if not eligible.empty:
        chosen = eligible.sort_values(
            ["benign_recall", "attack_f1"],
            ascending=False,
        ).iloc[0]
    else:
        # If no threshold meets the target, prioritize attack recall.
        chosen = val_results.sort_values(
            ["attack_recall", "benign_recall"],
            ascending=False,
        ).iloc[0]

    threshold = float(chosen["threshold"])

    print("\n=== Validation threshold comparison ===")
    print(val_results[
        [
            "threshold",
            "attack_recall",
            "benign_recall",
            "false_positive_rate",
            "attack_f1",
        ]
    ].to_string(index=False))

    print(f"\nSelected threshold: {threshold:.2f}")
    print("Selection rule: maximize benign recall while maintaining")
    print("at least 98% attack recall on the validation set.")

    # Evaluate the chosen threshold exactly once on the test set.
    test_probabilities = model.predict_proba(X_test)[:, 1]
    test_metrics = calculate_metrics(
        y_test, test_probabilities, threshold
    )
    test_predictions = (test_probabilities >= threshold).astype(int)

    print("\n=== Final held-out test results ===")
    for key, value in test_metrics.items():
        print(f"{key}: {value:.4f}" if isinstance(value, float)
              else f"{key}: {value}")

    print("\nClassification report:")
    print(classification_report(
        y_test,
        test_predictions,
        labels=[0, 1],
        target_names=["BENIGN", "ATTACK"],
        zero_division=0,
    ))

    matrix = confusion_matrix(
        y_test, test_predictions, labels=[0, 1]
    )
    pd.DataFrame(
        matrix,
        index=["Actual_BENIGN", "Actual_ATTACK"],
        columns=["Predicted_BENIGN", "Predicted_ATTACK"],
    ).to_csv(RESULTS_DIR / "xgboost_tuned_confusion_matrix.csv")

    pd.DataFrame([test_metrics]).to_csv(
        RESULTS_DIR / "xgboost_tuned_test_metrics.csv",
        index=False,
    )

    # Save the model together with the chosen threshold and feature order.
    joblib.dump(
        {
            "model": model,
            "feature_columns": X.columns.tolist(),
            "threshold": threshold,
            "target_mapping": {0: "BENIGN", 1: "ATTACK"},
        },
        MODEL_DIR / "network_ids_xgboost_tuned.joblib",
    )

    print("\nTuned model saved to:")
    print(MODEL_DIR / "network_ids_xgboost_tuned.joblib")
    print(f"Results saved to: {RESULTS_DIR}")


if __name__ == "__main__":
    main()
