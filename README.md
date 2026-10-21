# CyberPulse — IoT-Based Cyber-Physical Threat Monitoring

CyberPulse is an academic cybersecurity project that combines IoT machine-condition monitoring, network intrusion detection, and a cyber-physical correlation engine in a web dashboard.

## Main Components

- **IoT monitoring:** ESP8266-based machine monitoring with vibration and sound sensors.
- **Physical fault detection:** Machine-condition classification using vibration-derived features.
- **Network IDS:** Machine-learning-based binary classification of network traffic as benign or attack.
- **Correlation engine:** Experimental risk scoring that combines network predictions, physical fault predictions, and temporal evidence.
- **Dashboard and API:** React/Vite frontend with a FastAPI backend.

## Technology Stack

Python, FastAPI, React, Vite, scikit-learn, XGBoost, pandas, and ESP8266/Arduino firmware.

## Running Locally

### 1. Set up Python

Activate your existing virtual environment:

```powershell
.\.venv\Scripts\Activate.ps1
```

Install dependencies:

```powershell
pip install -r requirements.txt
```

### 2. Start the API

From the project root:

```powershell
python -m uvicorn api.main:app --reload --port 8000
```

### 3. Start the dashboard

Open another terminal:

```powershell
cd dashboard
npm install
npm run dev
```

Open the local URL printed by Vite, normally `http://localhost:5173`.

## Data and Model Files

Datasets, trained models, and generated results are excluded from this repository by default. Follow the project documentation for their sources and setup.

## Important Limitations

- Model metrics are based on the evaluated dataset and do not guarantee performance on unseen real-world traffic or machines.
- Correlation scores are experimental and are not proof that a cyberattack caused a physical fault.
- ThingSpeak/cloud integration should be considered unverified until end-to-end data transmission has been tested.

## Academic Project

Developed for ECE404 — IoT System Design: Software and Hardware Integration.
