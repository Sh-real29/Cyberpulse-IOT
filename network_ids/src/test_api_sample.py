
import json
from pathlib import Path

import pandas as pd
import requests

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATA_PATH = PROJECT_ROOT / "data" / "network_ids" / "ciciot2023_subset_50000.csv"
API_URL = "http://127.0.0.1:8000/network-ids/predict"

df = pd.read_csv(DATA_PATH)

# Select one benign sample if available; otherwise use the first row.
benign_rows = df[df["is_attack"] == 0]
if not benign_rows.empty:
    row = benign_rows.iloc[0]
else:
    row = df.iloc[0]

# Send only the 37 model features; exclude Label, family and is_attack.
metadata_columns = {"Label", "family", "is_attack"}
features = {
    column: float(row[column])
    for column in df.columns
    if column not in metadata_columns
}

response = requests.post(API_URL, json=features, timeout=30)

print("HTTP status:", response.status_code)
response.raise_for_status()

result = response.json()

print("\nGround-truth label:", row["Label"])
print("Ground-truth is_attack:", int(row["is_attack"]))
print("Model prediction:", result["prediction"])
print("Predicted is_attack:", result["is_attack"])
print("Attack probability:", result["attack_probability"])
print("Decision threshold:", result["threshold"])

print(
    "\nCorrect prediction:",
    int(row["is_attack"]) == result["is_attack"]
)
