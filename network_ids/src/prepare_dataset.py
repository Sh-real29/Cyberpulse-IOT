from pathlib import Path

import pandas as pd
from sklearn.model_selection import train_test_split

# Project paths
ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "data" / "network_ids" / "ciciot2023_clean.parquet"
OUTPUT_DIR = ROOT / "data" / "network_ids"
OUTPUT = OUTPUT_DIR / "ciciot2023_subset_50000.csv"

SAMPLE_SIZE = 50_000
RANDOM_STATE = 42

def main():
    if not SOURCE.exists():
        raise FileNotFoundError(f"Dataset not found: {SOURCE}")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    print("Loading dataset...")
    df = pd.read_parquet(SOURCE)

    # Check required target columns
    required = {"Label", "family", "is_attack"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"Missing required columns: {sorted(missing)}")

    if len(df) < SAMPLE_SIZE:
        raise ValueError(
            f"Dataset has only {len(df)} rows; "
            f"cannot sample {SAMPLE_SIZE}."
        )

    # Preserve the distribution of each attack label.
    subset, _ = train_test_split(
        df,
        train_size=SAMPLE_SIZE,
        stratify=df["Label"],
        random_state=RANDOM_STATE,
    )

    subset = subset.sample(frac=1, random_state=RANDOM_STATE)
    subset.to_csv(OUTPUT, index=False)

    print("\nSubset created successfully.")
    print(f"Saved to: {OUTPUT}")
    print(f"Shape: {subset.shape}")
    print("\nTop 15 labels in subset:")
    print(subset["Label"].value_counts().head(15))
    print("\nBinary attack distribution:")
    print(subset["is_attack"].value_counts())


if __name__ == "__main__":
    main()
