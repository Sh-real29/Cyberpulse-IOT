
import { useEffect, useState } from "react";
import "./App.css";

const API_BASE_URL = "http://127.0.0.1:8000";


const networkFeatureDefaults = {
  "Header_Length": "54",
  "Protocol Type": "6",
  "Time_To_Live": "64",
  "Rate": "10",
  "fin_flag_number": "0",
  "syn_flag_number": "1",
  "rst_flag_number": "0",
  "psh_flag_number": "0",
  "ack_flag_number": "1",
  "ece_flag_number": "0",
  "cwr_flag_number": "0",
  "ack_count": "1",
  "syn_count": "1",
  "fin_count": "0",
  "rst_count": "0",
  "HTTP": "0",
  "HTTPS": "1",
  "DNS": "0",
  "Telnet": "0",
  "SMTP": "0",
  "SSH": "0",
  "IRC": "0",
  "TCP": "1",
  "UDP": "0",
  "DHCP": "0",
  "ARP": "0",
  "ICMP": "0",
  "IGMP": "0",
  "IPv": "1",
  "Tot sum": "1200",
  "Min": "40",
  "Max": "1500",
  "AVG": "600",
  "Std": "100",
  "IAT": "1000",
  "Number": "5",
  "Variance": "10000",
};

const navigation = [
  { section: "WORKSPACE" },
  { label: "Overview", icon: "◫" },
  { label: "Physical Faults", icon: "⌁", active: true },
  { label: "Network IDS", icon: "⌘" },
  { label: "Correlation Engine", icon: "⤨" },
  { section: "SYSTEM" },
  { label: "Devices", icon: "▦" },
  { label: "Settings", icon: "⚙" },
];

const initialFeatures = {
  max: "0.35986",
  min: "-0.41890",
  mean: "0.017840",
  sd: "0.122746",
  rms: "0.124006",
  skewness: "-0.118571",
  kurtosis: "-0.042219",
  crest: "2.901946",
  form: "6.950855",
};

const featureLabels = {
  max: "Maximum amplitude",
  min: "Minimum amplitude",
  mean: "Mean",
  sd: "Standard deviation",
  rms: "RMS",
  skewness: "Skewness",
  kurtosis: "Kurtosis",
  crest: "Crest factor",
  form: "Form factor",
};


function getFaultCategory(fault) {
  if (fault === "Normal_1" || fault.toLowerCase().startsWith("normal")) {
    return { label: "Normal", className: "fault-normal" };
  }

  if (fault.startsWith("Ball_")) {
    return { label: "Ball fault", className: "fault-ball" };
  }

  if (fault.startsWith("IR_")) {
    return { label: "Inner race fault", className: "fault-inner" };
  }

  if (fault.startsWith("OR_")) {
    return { label: "Outer race fault", className: "fault-outer" };
  }

  return { label: "Unclassified", className: "fault-unknown" };
}


function App() {
  const [features, setFeatures] = useState(initialFeatures);
  const [prediction, setPrediction] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [apiStatus, setApiStatus] = useState("checking");
  const [predictionHistory, setPredictionHistory] = useState([]);
  const [actualFault, setActualFault] = useState("Normal_1");
  const [evaluationResult, setEvaluationResult] = useState(null);
  const [datasetSample, setDatasetSample] = useState(null);
  const [sampleLoading, setSampleLoading] = useState(false);
  const [datasetError, setDatasetError] = useState("");
  const [datasetClasses, setDatasetClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState("Normal_1");
  const [classSamples, setClassSamples] = useState([]);
  const [selectedRowIndex, setSelectedRowIndex] = useState("");
  const [browserLoading, setBrowserLoading] = useState(false);
  const [browserError, setBrowserError] = useState("");
  const [evaluationHistory, setEvaluationHistory] = useState([]);
  const [activeView, setActiveView] = useState("Physical Faults");
  const [networkFeatures, setNetworkFeatures] = useState(
    networkFeatureDefaults
  );
  const [networkPrediction, setNetworkPrediction] = useState(null);
  const [networkError, setNetworkError] = useState("");
  const [correlationInputs, setCorrelationInputs] = useState({
        network_prediction: "ATTACK",
        attack_probability: "0.99",
        physical_fault: "IR_014_1",
        physical_probability: "0.95",
        temporal_correlation: "0.8",
      });
  const [correlationResult, setCorrelationResult] = useState(null);
  const [correlationError, setCorrelationError] = useState("");
  const [correlationLoading, setCorrelationLoading] = useState(false);
  const [networkLoading, setNetworkLoading] = useState(false);
  const [networkHistory, setNetworkHistory] = useState([]);
  const [networkApiStatus, setNetworkApiStatus] = useState("checking");
  const [networkSample, setNetworkSample] = useState(null);
  const [networkSampleLoading, setNetworkSampleLoading] = useState(false);
  const [networkSampleError, setNetworkSampleError] = useState("");

  // Check backend availability on load and every 10 seconds.
  useEffect(() => {
    let active = true;
    let checking = false;

    async function checkApiHealth() {
      if (checking) return;
      checking = true;

      try {
        const response = await fetch(`${API_BASE_URL}/health`, {
          signal: AbortSignal.timeout(4000),
        });

        if (!response.ok) {
          throw new Error("Health check failed");
        }

        const data = await response.json();

        if (active) {
          setApiStatus(
            data.status === "ok" ? "connected" : "disconnected"
          );
        }
      } catch {
        if (active) {
          setApiStatus("disconnected");
        }
      } finally {
        checking = false;
      }
    }

    checkApiHealth();

    const intervalId = setInterval(checkApiHealth, 10000);

    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, []);
  

async function loadDatasetSample(random = true) {
  setSampleLoading(true);
  setDatasetError("");
  setEvaluationResult(null);

  try {
    const endpoint = random
      ? `${API_BASE_URL}/dataset/random-sample`
      : `${API_BASE_URL}/dataset/sample/0`;

    const response = await fetch(endpoint);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || "Could not load dataset sample.");
    }

    setDatasetSample(data);
    setFeatures(
      Object.fromEntries(
        Object.entries(data.features).map(([key, value]) => [
          key,
          String(value),
        ])
      )
    );

    setActualFault(data.actual_fault);
    setPrediction("");
    setError("");
  } catch (err) {
    setDatasetError(err.message);
  } finally {
    setSampleLoading(false);
  }
}

async function evaluateDatasetSample() {
  if (!datasetSample) {
    setDatasetError("Load a labelled dataset sample first.");
    return;
  }

  setLoading(true);
  setDatasetError("");
  setEvaluationResult(null);
  setError("");

  try {
    const response = await fetch(`${API_BASE_URL}/evaluate-labelled`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...datasetSample.features,
        actual_fault: datasetSample.actual_fault,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || "Evaluation failed.");
    }

    setEvaluationResult(data);
    setPrediction(data.predicted_fault);
  } catch (err) {
    setDatasetError(err.message);
  } finally {
    setLoading(false);
  }
}

  async function evaluateLabelledSample(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setEvaluationResult(null);

    try {
      const response = await fetch(`${API_BASE_URL}/evaluate-labelled`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...Object.fromEntries(
            Object.entries(features).map(([key, value]) => [
              key,
              Number(value),
            ])
          ),
          actual_fault: actualFault,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : "Labelled evaluation failed."
        );
      }

      setEvaluationResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function runPrediction(event) {
    event.preventDefault();

    setLoading(true);
    setPrediction("");
    setError("");

    try {
      const numericFeatures = Object.fromEntries(
        Object.entries(features).map(([key, value]) => [
          key,
          Number(value),
        ])
      );

      if (
        Object.values(numericFeatures).some(
          (value) => !Number.isFinite(value)
        )
      ) {
        throw new Error("Please enter valid finite numbers for all features.");
      }

      const response = await fetch(`${API_BASE_URL}/predict`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(numericFeatures),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data.detail === "string"
            ? data.detail
            : "The prediction request failed."
        );
      }

      if (!data.predicted_fault) {
        throw new Error("The API response did not contain a predicted fault.");
      }

      setPrediction(data.predicted_fault);

const category = getFaultCategory(data.predicted_fault);

setPredictionHistory((current) =>
  [
    {
      id: `${Date.now()}-${Math.random()}`,
      fault: data.predicted_fault,
      category: category.label,
      categoryClass: category.className,
      probability: data.predicted_class_probability,
      time: new Date().toLocaleTimeString(),
    },
    ...current,
  ].slice(0, 5)
);
      setApiStatus("connected");
    } catch (err) {
      setError(
        `${err.message}. Check that the FastAPI backend is running at ${API_BASE_URL}.`
      );
      setApiStatus("disconnected");
    } finally {
      setLoading(false);
    }
  }

  function resetFeatures() {
    setFeatures({ ...initialFeatures });
    setPrediction("");
    setError("");
  }


  function handleNavigation(label, active) {
    const availableViews = [
      "Physical Faults",
      "Network IDS",
      "Correlation Engine",
    ];

    if (availableViews.includes(label)) {
      setActiveView(label);
      setError("");
      setNetworkError("");
      return;
    }

    setError(`${label} is not implemented yet.`);
  }

      async function loadNetworkDatasetSample(random = true) {
      setNetworkSampleLoading(true);
      setNetworkSampleError("");
      setNetworkPrediction(null);
      setNetworkError("");

      try {
        const endpoint = random
          ? `${API_BASE_URL}/network-ids/dataset/random-sample`
          : `${API_BASE_URL}/network-ids/dataset/sample/0`;

        const response = await fetch(endpoint);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            typeof data.detail === "string"
              ? data.detail
              : "Could not load a Network IDS dataset sample."
          );
        }

        setNetworkFeatures(
          Object.fromEntries(
            Object.entries(data.features).map(([key, value]) => [
              key,
              String(value),
            ])
          )
        );

        setNetworkSample(data);
      } catch (err) {
        setNetworkSampleError(err.message);
      } finally {
        setNetworkSampleLoading(false);
      }
    }

async function runNetworkPrediction(event) {
  event.preventDefault();
  setNetworkLoading(true);
  setNetworkError("");
  setNetworkPrediction(null);

  try {
    const numericFeatures = Object.fromEntries(
      Object.entries(networkFeatures).map(([key, value]) => [
        key,
        Number(value),
      ])
    );

    if (
      Object.values(numericFeatures).some(
        (value) => !Number.isFinite(value)
      )
    ) {
      throw new Error("Enter valid finite numbers for all 37 features.");
    }

    const response = await fetch(
      `${API_BASE_URL}/network-ids/predict`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(numericFeatures),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        typeof data.detail === "string"
          ? data.detail
          : "Network IDS prediction failed."
      );
    }

    setNetworkPrediction(data);
    setNetworkApiStatus("connected");

    setNetworkHistory((current) => [
      {
         id: `${Date.now()}-${Math.random()}`,
         prediction: data.prediction,
         is_attack: Boolean(data.is_attack),
         probability: data.attack_probability,
         threshold: data.threshold,
         time: new Date().toLocaleTimeString(),
      },
      ...current,
    ].slice(0, 10));
  } catch (err) {
    setNetworkError(
      `${err.message}. Confirm the FastAPI server is running at ${API_BASE_URL}.`
    );
    setNetworkApiStatus("disconnected");
  } finally {
    setNetworkLoading(false);
  }
}

  const apiStatusLabel = {
    checking: "CHECKING API",
    connected: "API CONNECTED",
    disconnected: "API DISCONNECTED",
  }[apiStatus];

  const apiSidebarTitle = {
    checking: "Checking backend",
    connected: "API connected",
    disconnected: "API disconnected",
  }[apiStatus];

  const apiSidebarDescription = {
    checking: "Verifying local endpoint...",
    connected: "Physical fault API responding",
    disconnected: "Start or restart the FastAPI server",
  }[apiStatus];

  
    async function runCorrelationAnalysis(event) {
      event.preventDefault();
      setCorrelationLoading(true);
      setCorrelationError("");
      setCorrelationResult(null);

      try {
        const payload = {
          network_prediction: correlationInputs.network_prediction,
          attack_probability: Number(correlationInputs.attack_probability),
          physical_fault: correlationInputs.physical_fault,
          physical_probability: Number(correlationInputs.physical_probability),
          temporal_correlation: Number(correlationInputs.temporal_correlation),
        };

        const response = await fetch(`${API_BASE_URL}/correlation/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            typeof data.detail === "string"
              ? data.detail
              : "Correlation analysis failed."
          );
        }

        setCorrelationResult(data);
      } catch (err) {
        setCorrelationError(
          `${err.message}. Confirm that FastAPI is running at ${API_BASE_URL}.`
        );
      } finally {
        setCorrelationLoading(false);
      }
    }

        
      async function loadDatasetClasses() {
        try {
          const response = await fetch(`${API_BASE_URL}/dataset/classes`);
          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.detail || "Could not load fault classes.");
          }

          setDatasetClasses(data.classes);

          if (
            data.classes.length > 0 &&
            !data.classes.some((item) => item.label === selectedClass)
          ) {
            setSelectedClass(data.classes[0].label);
          }
        } catch (err) {
          setBrowserError(err.message);
        }
      }

        async function loadClassSamples(className) {
          setBrowserLoading(true);
          setBrowserError("");
          setClassSamples([]);
          setSelectedRowIndex("");

          try {
            const response = await fetch(
              `${API_BASE_URL}/dataset/classes/${encodeURIComponent(className)}/samples?limit=100`
            );
            const data = await response.json();

            if (!response.ok) {
              throw new Error(data.detail || "Could not load dataset samples.");
            }

            setClassSamples(data.samples);

            if (data.samples.length > 0) {
              setSelectedRowIndex(String(data.samples[0].row_index));
            }
          } catch (err) {
            setBrowserError(err.message);
          } finally {
            setBrowserLoading(false);
          }
        }

        async function evaluateSelectedSample() {
          const sample = classSamples.find(
            (item) => String(item.row_index) === selectedRowIndex
          );

          if (!sample) {
            setBrowserError("Select a valid dataset sample first.");
            return;
          }

          setBrowserLoading(true);
          setBrowserError("");

          try {
            const response = await fetch(`${API_BASE_URL}/evaluate-labelled`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                ...sample.features,
                actual_fault: sample.actual_fault,
              }),
            });

            const data = await response.json();

            if (!response.ok) {
              throw new Error(data.detail || "Evaluation failed.");
            }

            setEvaluationHistory((current) => [
              {
                ...data,
                row_index: sample.row_index,
                id: `${sample.row_index}-${Date.now()}`,
                time: new Date().toLocaleTimeString(),
              },
              ...current,
            ]);
          } catch (err) {
            setBrowserError(err.message);
          } finally {
            setBrowserLoading(false);
          }
        }

      useEffect(() => {
      loadDatasetClasses();
      }, []);

      useEffect(() => {
        loadClassSamples(selectedClass);
      }, [selectedClass]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" aria-label="CyberPulse home">
          <span className="brand-mark">C</span>
          <span>
            <strong>CyberPulse</strong>
            <small>INDUSTRIAL INTELLIGENCE</small>
          </span>
        </a>

        <nav className="nav-group" aria-label="Main navigation">
          {navigation.map((item, index) =>
            item.section ? (
              <p className="nav-section" key={`${item.section}-${index}`}>
                {item.section}
              </p>
            ) : (
              <button
                className={`nav-item ${
                  (item.label === activeView) ? "active" : ""
         }`}
                key={item.label}
                type="button"
                aria-current={item.label === activeView ? "page" : undefined}
                onClick={() =>
                  handleNavigation(item.label, Boolean(item.active))
                }
              >
                <span className="nav-icon" aria-hidden="true">
                  {item.icon}
                </span>
                {item.label}
                {item.active && <span className="active-dot" />}
              </button>
            )
          )}
        </nav>

        <div className="sidebar-bottom">
          <div
            className={`connection-indicator api-status-${apiStatus}`}
            role="status"
            aria-live="polite"
          >
            <span className="status-dot" />
            <span>
              <strong>{apiSidebarTitle}</strong>
              <small>{apiSidebarDescription}</small>
            </span>
          </div>
          <p>CYBERPULSE · DEVELOPMENT</p>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <span>/</span>
            {activeView === "Network IDS" ? (
              <>Cybersecurity <span>/</span> <strong>Network IDS</strong></>
            ) : activeView === "Correlation Engine" ? (
              <>Cybersecurity <span>/</span> <strong>Correlation Engine</strong></>
            ) : (
              <>Physical ML <span>/</span> <strong>Fault detection</strong></>
            )}
          </div>

          <div className="topbar-right">
            <span
              className={`environment-label api-status-${apiStatus}`}
              role="status"
              aria-live="polite"
            >
              <span className="status-dot" />
              {apiStatusLabel}
            </span>
            <div className="avatar" aria-label="CyberPulse workspace">
              CP
            </div>
          </div>
        </header>

        <div className="page-content">
          {activeView === "Correlation Engine" ? (
            <section className="network-ids-view correlation-view">
              <section className="page-heading">
                <div>
                  <p className="eyebrow">CYBER-PHYSICAL INTELLIGENCE</p>
                  <h1>Correlation Engine</h1>
                  <p className="page-description">
                    Combine network security signals, physical fault predictions,
                    and temporal evidence in an experimental risk-scoring engine.
                  </p>
                </div>
                <div className="model-badge">
                  <span className="status-dot" />
                  Prototype Engine
                </div>
              </section>

              <section className="metrics-grid">
                <article className="metric-card">
                  <span className="metric-foot">ANOMALY SCORE</span>
                  <strong className="metric-value">
                    {correlationResult
                      ? `${correlationResult.cyber_physical_score}/100`
                      : "—"}
                  </strong>
                  <span className="metric-foot">Prototype heuristic score</span>
                </article>
                <article className="metric-card">
                  <span className="metric-foot">RISK LEVEL</span>
                  <strong className="metric-value metric-word">
                    {correlationResult?.risk_level ?? "Not analyzed"}
                  </strong>
                  <span className="metric-foot">Configured score bands</span>
                </article>
                <article className="metric-card">
                  <span className="metric-foot">NETWORK SIGNAL</span>
                  <strong className="metric-value metric-word">
                    {correlationResult
                      ? correlationResult.network_is_attack ? "Attack" : "Benign"
                      : "—"}
                  </strong>
                  <span className="metric-foot">Supplied IDS classification</span>
                </article>
                <article className="metric-card">
                  <span className="metric-foot">PHYSICAL SIGNAL</span>
                  <strong className="metric-value metric-word">
                    {correlationResult
                      ? correlationResult.physical_is_anomaly ? "Anomaly" : "Normal"
                      : "—"}
                  </strong>
                  <span className="metric-foot">Supplied fault classification</span>
                </article>
              </section>

              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">ANALYSIS INPUTS</p>
                    <h2>Configure cyber-physical signals</h2>
                    <p>Enter the outputs from both models and temporal evidence.</p>
                  </div>
                </div>

                <form onSubmit={runCorrelationAnalysis}>
                  <div className="correlation-input-grid">
                    <label className="feature-field">
                      <span>Network prediction</span>
                      <select
                        value={correlationInputs.network_prediction}
                        onChange={(event) => {
                          setCorrelationInputs((current) => ({
                            ...current,
                            network_prediction: event.target.value,
                          }));
                          setCorrelationResult(null);
                        }}
                      >
                        <option value="BENIGN">BENIGN</option>
                        <option value="ATTACK">ATTACK</option>
                      </select>
                    </label>

                    <label className="feature-field">
                      <span>Attack probability (0–1)</span>
                      <input
                        type="number" min="0" max="1" step="0.01" required
                        value={correlationInputs.attack_probability}
                        onChange={(event) => {
                          setCorrelationInputs((current) => ({
                            ...current,
                            attack_probability: event.target.value,
                          }));
                          setCorrelationResult(null);
                        }}
                      />
                    </label>

                    <label className="feature-field">
                      <span>Physical fault</span>
                      <select
                        value={correlationInputs.physical_fault}
                        onChange={(event) => {
                          setCorrelationInputs((current) => ({
                            ...current,
                            physical_fault: event.target.value,
                          }));
                          setCorrelationResult(null);
                        }}
                      >
                        <option value="Normal_1">Normal</option>
                        <option value="Ball_007_1">Ball fault · 007</option>
                        <option value="Ball_014_1">Ball fault · 014</option>
                        <option value="Ball_021_1">Ball fault · 021</option>
                        <option value="IR_007_1">Inner race fault · 007</option>
                        <option value="IR_014_1">Inner race fault · 014</option>
                        <option value="IR_021_1">Inner race fault · 021</option>
                        <option value="OR_007_6_1">Outer race fault · 007</option>
                        <option value="OR_014_6_1">Outer race fault · 014</option>
                        <option value="OR_021_6_1">Outer race fault · 021</option>
                      </select>
                    </label>

                    <label className="feature-field">
                      <span>Physical probability (0–1)</span>
                      <input
                        type="number" min="0" max="1" step="0.01" required
                        value={correlationInputs.physical_probability}
                        onChange={(event) => {
                          setCorrelationInputs((current) => ({
                            ...current,
                            physical_probability: event.target.value,
                          }));
                          setCorrelationResult(null);
                        }}
                      />
                    </label>

                    <label className="feature-field">
                      <span>Temporal evidence (0–1)</span>
                      <input
                        type="number" min="0" max="1" step="0.01" required
                        value={correlationInputs.temporal_correlation}
                        onChange={(event) => {
                          setCorrelationInputs((current) => ({
                            ...current,
                            temporal_correlation: event.target.value,
                          }));
                          setCorrelationResult(null);
                        }}
                      />
                    </label>
                  </div>

                  <div className="form-actions">
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => {
                        setCorrelationInputs({
                          network_prediction: "BENIGN",
                          attack_probability: "0.1",
                          physical_fault: "Normal_1",
                          physical_probability: "0.95",
                          temporal_correlation: "0",
                        });
                        setCorrelationResult(null);
                        setCorrelationError("");
                      }}
                    >
                      Load normal scenario
                    </button>
                    <button type="submit" className="primary-button" disabled={correlationLoading}>
                      {correlationLoading ? "Analyzing..." : "Analyze correlation"}
                    </button>
                  </div>
                </form>

                {correlationError && (
                  <div className="result-message error" role="alert">
                    {correlationError}
                  </div>
                )}
              </section>

              {correlationResult && (
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <p className="eyebrow">ANALYSIS RESULT</p>
                      <h2>Cyber-physical risk assessment</h2>
                      <p>Risk score and signals returned by the correlation API.</p>
                    </div>
                    <span className={`fault-badge ${
                      correlationResult.risk_level === "HIGH"
                        ? "fault-outer"
                        : correlationResult.risk_level === "MODERATE"
                          ? "fault-ball"
                          : "fault-normal"
                    }`}>
                      {correlationResult.risk_level}
                    </span>
                  </div>

                  <div
                    className="correlation-score-track"
                    role="img"
                    aria-label={`Cyber-physical score ${correlationResult.cyber_physical_score} out of 100`}
                  >
                    <span style={{ width: `${correlationResult.cyber_physical_score}%` }} />
                  </div>

                  <h3>Contributing signals</h3>
                  <ul className="correlation-signals">
                    {correlationResult.signals.map((signal, index) => (
                      <li key={`${index}-${signal}`}>{signal}</li>
                    ))}
                  </ul>
                  <p className="correlation-warning">{correlationResult.warning}</p>
                </section>
              )}
            </section>
          ) : activeView === "Network IDS" ? (
              <section className="network-ids-view">
                <section className="page-heading">
                  <div>
                    <p className="eyebrow">NETWORK INTELLIGENCE / CYBERSECURITY</p>
                    <h1>Network Intrusion Detection</h1>
                    <p className="page-description">
                      Analyze network-flow features using the trained XGBoost
                      classifier. This interface currently supports manual,
                      sample-based inference rather than live packet capture.
                    </p>
                  </div>
                  <div className="model-badge">
                    <span className="status-dot" />
                    XGBoost IDS
                    <span className="badge-divider" />
                    v1.0
                  </div>
                </section>

                <section className="metrics-grid">
                  <article className="metric-card">
                    <span className="metric-foot">MODEL FEATURES</span>
                    <strong className="metric-value">37</strong>
                    <span className="metric-foot">Network-flow inputs</span>
                  </article>
                  <article className="metric-card">
                    <span className="metric-foot">DECISION THRESHOLD</span>
                    <strong className="metric-value">80%</strong>
                    <span className="metric-foot">Configured attack cutoff</span>
                  </article>
                  <article className="metric-card">
                    <span className="metric-foot">SESSION PREDICTIONS</span>
                    <strong className="metric-value">{networkHistory.length}</strong>
                    <span className="metric-foot">Latest 10 results retained</span>
                  </article>
                  <article className="metric-card">
                    <span className="metric-foot">IDS API STATUS</span>
                    <strong className="metric-value metric-word">
                      {networkApiStatus === "connected"
                        ? "Connected"
                        : networkApiStatus === "disconnected"
                          ? "Disconnected"
                          : "Not checked"}
                    </strong>
                    <span className="metric-foot">Network IDS endpoint</span>
                  </article>
                </section>

                <section className="panel ids-evaluation-panel">
                  <div className="panel-heading">
                    <div>
                      <p className="eyebrow">HELD-OUT TEST SET</p>
                      <h2>XGBoost model evaluation</h2>
                      <p>
                        Performance measured on the saved test split using the tuned
                        decision threshold.
                      </p>
                    </div>
                    <span className="ids-threshold-badge">Threshold · 0.80</span>
                  </div>

                  <div className="ids-evaluation-metrics">
                    <article className="ids-evaluation-card">
                      <span>Accuracy</span>
                      <strong>98.25%</strong>
                      <small>Overall correct predictions</small>
                    </article>

                    <article className="ids-evaluation-card">
                      <span>Attack recall</span>
                      <strong>98.44%</strong>
                      <small>Attacks correctly detected</small>
                    </article>

                    <article className="ids-evaluation-card">
                      <span>Benign recall</span>
                      <strong>93.28%</strong>
                      <small>Benign traffic correctly identified</small>
                    </article>

                    <article className="ids-evaluation-card">
                      <span>ROC-AUC</span>
                      <strong>99.53%</strong>
                      <small>Class separation performance</small>
                    </article>
                  </div>

                    <article className="ids-evaluation-card">
                      <span>Attack precision</span>
                      <strong>99.74%</strong>
                      <small>Predicted attacks that were actual attacks</small>
                    </article>

                    <article className="ids-evaluation-card">
                      <span>Attack F1-score</span>
                      <strong>99.09%</strong>
                      <small>Balance of attack precision and recall</small>
                    </article>

                    <article className="ids-evaluation-card">
                        <span>Attack precision</span>
                        <strong>99.74%</strong>
                        <small>Predicted attacks that were actual attacks</small>
                      </article>

                      <article className="ids-evaluation-card">
                        <span>Attack F1-score</span>
                        <strong>99.09%</strong>
                        <small>Balance of attack precision and recall</small>
                      </article>

                  <div className="ids-confusion-section">
                    <div>
                      <h3>Confusion matrix</h3>
                      <p>Rows are actual labels; columns are predicted labels.</p>
                    </div>

                    <div className="ids-table-wrap">
                      <table className="ids-confusion-table">
                        <thead>
                          <tr>
                            <th>Actual / Predicted</th>
                            <th>Benign</th>
                            <th>Attack</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <th>Benign</th>
                            <td className="ids-cell-correct">347</td>
                            <td className="ids-cell-error">25</td>
                          </tr>
                          <tr>
                            <th>Attack</th>
                            <td className="ids-cell-error">150</td>
                            <td className="ids-cell-correct">9,478</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <div className="ids-error-summary">
                      <div>
                        <span>False positives</span>
                        <strong>25</strong>
                        <small>Benign samples flagged as attacks</small>
                      </div>
                      <div>
                        <span>False negatives</span>
                        <strong>150</strong>
                        <small>Attack samples classified as benign</small>
                      </div>
                    </div>
                  </div>

                  <p className="ids-evaluation-note">
                    These are offline test-set results, not live production performance.
                    Attack probabilities are uncalibrated, and the test split alone does
                    not establish generalization to unseen network environments.
                  </p>
                </section>

                <section className="panel network-form-panel">
                  <div className="panel-heading">
                    <div>
                      <p className="eyebrow">INFERENCE WORKSPACE</p>
                      <h2>Analyze a network-flow sample</h2>
                      <p>
                        Enter numeric values for all 37 features expected by the API.
                      </p>
                    </div>
                  </div>

                  <div className="dataset-actions network-dataset-actions">
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={networkSampleLoading}
                      onClick={() => loadNetworkDatasetSample(false)}
                    >
                      Load row 0
                    </button>

                    <button
                      type="button"
                      className="secondary-button"
                      disabled={networkSampleLoading}
                      onClick={() => loadNetworkDatasetSample(true)}
                    >
                      {networkSampleLoading ? "Loading sample..." : "Load random real sample"}
                    </button>
                  </div>

                  {networkSampleError && (
                    <div className="result-message error" role="alert">
                      {networkSampleError}
                    </div>
                  )}

                  {networkSample && (
                    <div className="dataset-sample-info network-sample-info">
                      <div>
                        <span>Dataset row</span>
                        <strong>{networkSample.row_index}</strong>
                      </div>
                      <div>
                        <span>True label</span>
                        <strong>{networkSample.label}</strong>
                      </div>
                      <div>
                        <span>Traffic family</span>
                        <strong>{networkSample.family}</strong>
                      </div>
                      <div>
                        <span>Ground truth</span>
                        <strong>{networkSample.is_attack ? "ATTACK" : "BENIGN"}</strong>
                      </div>
                    </div>
                  )}

                  <form onSubmit={runNetworkPrediction}>
                    <div className="feature-grid">
                      {Object.entries(networkFeatures).map(([key, value]) => (
                        <label className="feature-field" key={key}>
                          <span>{key}</span>
                          <input
                            type="number"
                            step="any"
                            required
                            value={value}
                            onChange={(event) =>
                              setNetworkFeatures((current) => ({
                                ...current,
                                [key]: event.target.value,
                              }))
                            }
                          />
                        </label>
                      ))}
                    </div>

                    <div className="form-actions">
                      <button
                        className="secondary-button"
                        type="button"
                        onClick={() => {
                          setNetworkFeatures({ ...networkFeatureDefaults });
                          setNetworkPrediction(null);
                          setNetworkError("");
                        }}
                      >
                        Reset sample
                      </button>
                      <button
                        className="primary-button"
                        type="submit"
                        disabled={networkLoading}
                      >
                        {networkLoading ? "Analyzing..." : "Analyze network flow"}
                      </button>
                    </div>
                  </form>

                  {networkError && (
                    <div className="result-message error" role="alert">
                      {networkError}
                    </div>
                  )}

                  {networkPrediction && (
                    <div
                      className={`result-message ${
                        networkPrediction.is_attack ? "error" : "success"
                      }`}
                      role="status"
                    >
                      <span className="result-kicker">NETWORK IDS RESULT</span>
                      <strong>{networkPrediction.prediction}</strong>
                      <span>
                        Attack probability:{" "}
                        {(networkPrediction.attack_probability * 100).toFixed(2)}%
                      </span>
                      <span>
                        Decision threshold:{" "}
                        {(networkPrediction.threshold * 100).toFixed(0)}%
                      </span>

                    {networkSample && (
                      <span>
                        Ground truth: {networkSample.is_attack ? "ATTACK" : "BENIGN"}
                        {" · "}
                        {Boolean(networkPrediction.is_attack) ===
                        Boolean(networkSample.is_attack)
                          ? "Prediction matches label"
                          : "Prediction differs from label"}
                      </span>
                    )}

                      <div
                        className="metric-bar"
                        role="img"
                        aria-label={`Attack probability ${(networkPrediction.attack_probability * 100).toFixed(2)} percent`}
                      >
                        <span
                          style={{
                            width: `${Math.max(
                              0,
                              Math.min(100, networkPrediction.attack_probability * 100)
                            )}%`,
                            background: networkPrediction.is_attack
                              ? "#ff718a"
                              : "#60e2b2",
                          }}
                        />
                      </div>
                      <small>
                        Model probability is uncalibrated and is not a guarantee
                        that traffic is malicious or benign.
                      </small>
                    </div>
                  )}
                </section>

                <section className="panel history-panel">
                  <div className="panel-heading">
                    <div>
                      <p className="eyebrow">RECENT INFERENCE</p>
                      <h2>Network prediction history</h2>
                      <p>Recent results from this browser session.</p>
                    </div>
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={networkHistory.length === 0}
                      onClick={() => setNetworkHistory([])}
                    >
                      Clear history
                    </button>
                  </div>

                  {networkHistory.length === 0 ? (
                    <div className="history-empty">
                      <strong>No network predictions yet</strong>
                      <span>Submit a sample to populate this table.</span>
                    </div>
                  ) : (
                    <div className="history-list">
                      {networkHistory.map((item, index) => (
                        <div className="history-row" key={item.id}>
                          <span className="history-index">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <div className="history-fault">
                            <strong>{item.prediction}</strong>
                            <span>{item.time}</span>
                          </div>
                          <span
                            className={`fault-badge ${
                              item.is_attack ? "fault-outer" : "fault-normal"
                            }`}
                          >
                            {item.is_attack ? "Attack" : "Benign"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </section>

          ) : (
            <>
          <section className="page-heading">
            <div>
              <p className="eyebrow">MACHINE INTELLIGENCE / PHYSICAL ML</p>
              <h1>Physical Fault Detection</h1>
              <p className="page-description">
                Analyze engineered vibration features and classify bearing
                conditions using your trained Random Forest model.
              </p>
            </div>

            <div className="model-badge">
              <span className="status-dot" />
              Random Forest
              <span className="badge-divider" />
              v1.0
            </div>
          </section>

          <section className="metrics-grid" aria-label="Model summary">
            <article className="metric-card">
              <div className="metric-top">
                <span>MODEL TEST ACCURACY</span>
                <span className="metric-icon purple" aria-hidden="true">
                  ↗
                </span>
              </div>
              <strong className="metric-value">94.57%</strong>
              <span className="metric-foot">
                Existing stratified test split
              </span>
              <div
                className="metric-bar"
                role="img"
                aria-label="Recorded test accuracy 94.57 percent"
              >
                <span style={{ width: "94.57%" }} />
              </div>
            </article>

            <article className="metric-card">
              <div className="metric-top">
                <span>FAULT CLASSES</span>
                <span className="metric-icon blue" aria-hidden="true">
                  ⌘
                </span>
              </div>
              <strong className="metric-value">10</strong>
              <span className="metric-foot">Trained bearing conditions</span>
              <div className="class-chips">
                <span>Ball</span>
                <span>Inner race</span>
                <span>Outer race</span>
              </div>
            </article>

            <article className="metric-card">
              <div className="metric-top">
                <span>INPUT FEATURES</span>
                <span className="metric-icon violet" aria-hidden="true">
                  ⌁
                </span>
              </div>
              <strong className="metric-value">09</strong>
              <span className="metric-foot">
                Engineered signal statistics
              </span>
              <div className="feature-mini-bars" aria-hidden="true">
                {[40, 72, 53, 89, 62, 77, 46, 96, 66].map((height, i) => (
                  <span key={i} style={{ height: `${height}%` }} />
                ))}
              </div>
            </article>

            <article className="metric-card">
              <div className="metric-top">
                <span>API MODE</span>
                <span className="metric-icon green" aria-hidden="true">
                  ⌘
                </span>
              </div>
              <strong className="metric-value metric-word">On demand</strong>
              <span className="metric-foot">
                Predictions requested manually
              </span>
              <span className={`api-note api-status-${apiStatus}`}>
                <span className="status-dot" />
                {apiStatus === "checking"
                  ? "Checking local API..."
                  : apiStatus === "connected"
                    ? "Local API responding"
                    : "Local API unavailable"}
              </span>
            </article>
          </section>


          <section className="panel history-panel dataset-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">DATASET VALIDATION</p>
                <h2>Test with a labelled sample</h2>
                <p>
                  Load a real row from your bearing dataset and compare the prediction
                  with its recorded label.
                </p>
              </div>
            </div>

            <div className="dataset-actions">
              <button
                type="button"
                className="secondary-button"
                disabled={sampleLoading}
                onClick={() => loadDatasetSample(false)}
              >
                Load first sample
              </button>

              <button
                type="button"
                className="primary-button"
                disabled={sampleLoading}
                onClick={() => loadDatasetSample(true)}
              >
                {sampleLoading ? "Loading..." : "Load random sample"}
              </button>
            </div>

            {datasetError && (
              <div className="result-message error" role="alert">
                {datasetError}
              </div>
            )}

            {datasetSample && (
              <div className="dataset-sample-info">
                <div>
                  <span>Dataset row</span>
                  <strong>{datasetSample.row_index}</strong>
                </div>

                <div>
                  <span>Actual recorded label</span>
                  <strong>{datasetSample.actual_fault}</strong>
                </div>

                <button
                  type="button"
                  className="primary-button"
                  disabled={loading}
                  onClick={evaluateDatasetSample}
                >
                  {loading ? "Evaluating..." : "Evaluate this sample"}
                </button>
              </div>
            )}

          </section>
          
          <section className="panel history-panel dataset-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">DATASET EXPLORER</p>
                <h2>Browse labelled samples</h2>
                <p>
                  Select a fault category and a real CSV row to evaluate the model.
                </p>
              </div>
            </div>

            <div className="dataset-browser-controls">
              <label className="feature-field">
                <span>Fault category</span>
                <select
                  value={selectedClass}
                  onChange={(event) => setSelectedClass(event.target.value)}
                >
                  {datasetClasses.map((item) => (
                    <option key={item.label} value={item.label}>
                      {item.label} ({item.count})
                    </option>
                  ))}
                </select>
              </label>

              <label className="feature-field">
                <span>Dataset sample</span>
                <select
                  value={selectedRowIndex}
                  onChange={(event) => setSelectedRowIndex(event.target.value)}
                  disabled={browserLoading || classSamples.length === 0}
                >
                  {classSamples.map((sample) => (
                    <option key={sample.row_index} value={String(sample.row_index)}>
                      Row {sample.row_index} — {sample.actual_fault}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                className="primary-button"
                onClick={evaluateSelectedSample}
                disabled={browserLoading || !selectedRowIndex}
              >
                {browserLoading ? "Loading..." : "Evaluate selected sample"}
              </button>
            </div>

            {browserError && (
              <div className="result-message error" role="alert">
                {browserError}
              </div>
            )}

            {classSamples.length > 0 && (
              <div className="dataset-sample-info">
                <div>
                  <span>Selected row</span>
                  <strong>{selectedRowIndex}</strong>
                </div>
                <div>
                  <span>Actual dataset label</span>
                  <strong>
                    {classSamples.find(
                      (sample) => String(sample.row_index) === selectedRowIndex
                    )?.actual_fault}
                  </strong>
                </div>
              </div>
            )}
          </section>
          
          <section className="panel history-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">EVALUATION SESSION</p>
                <h2>Evaluation summary</h2>
                <p>
                  Results from labelled samples evaluated during this page session.
                </p>
              </div>

              <button
                type="button"
                className="secondary-button"
                onClick={() => setEvaluationHistory([])}
                disabled={evaluationHistory.length === 0}
              >
                Clear results
              </button>
            </div>

            {evaluationHistory.length === 0 ? (
              <div className="history-empty">
                <strong>No labelled evaluations yet</strong>
                <span>Choose a sample above and evaluate it to begin.</span>
              </div>
            ) : (
              <>
                <div className="metrics-grid evaluation-metrics">
                  <article className="metric-card">
                    <span className="metric-foot">Samples evaluated</span>
                    <strong className="metric-value">{evaluationHistory.length}</strong>
                  </article>

                  <article className="metric-card">
                    <span className="metric-foot">Correct</span>
                    <strong className="metric-value">
                      {evaluationHistory.filter((item) => item.correct).length}
                    </strong>
                  </article>

                  <article className="metric-card">
                    <span className="metric-foot">Incorrect</span>
                    <strong className="metric-value">
                      {evaluationHistory.filter((item) => !item.correct).length}
                    </strong>
                  </article>

                  <article className="metric-card">
                    <span className="metric-foot">Session accuracy</span>
                    <strong className="metric-value">
                      {(
                        (evaluationHistory.filter((item) => item.correct).length /
                          evaluationHistory.length) *
                        100
                      ).toFixed(1)}
                      %
                    </strong>
                  </article>
                </div>

                <div className="history-list">
                  {evaluationHistory.map((item) => (
                    <div className="history-row" key={item.id}>
                      <span className="history-index">#{item.row_index}</span>

                      <div className="history-fault">
                        <strong>{item.predicted_fault}</strong>
                        <span>
                          Actual: {item.actual_fault} · {item.time}
                        </span>
                      </div>

                      <span
                        className={`fault-badge ${
                          item.correct ? "fault-normal" : "fault-outer"
                        }`}
                      >
                        {item.correct ? "Correct" : "Incorrect"}
                      </span>

                      <span className="history-probability">
                        {(item.predicted_class_probability * 100).toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>


          <section className="analysis-grid">
            <article className="panel prediction-panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">INFERENCE WORKSPACE</p>
                  <h2>Run fault prediction</h2>
                  <p>
                    Enter the nine features calculated from a vibration signal.
                  </p>
                </div>
                <div className="panel-symbol" aria-hidden="true">
                  ⌁
                </div>
              </div>

              <form onSubmit={runPrediction}>
                <div className="form-section-title">
                  <span>01</span>
                  SIGNAL FEATURES
                  <span className="section-count">9 PARAMETERS</span>
                </div>

              
              <section className="panel history-panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">MODEL VALIDATION</p>
                    <h2>Actual vs predicted</h2>
                    <p>Compare the model output against a known dataset label.</p>
                  </div>
                </div>

                <form onSubmit={evaluateLabelledSample}>
                  <label className="feature-field">
                    <span>Reference label for this sample</span>
                    <select
                      value={actualFault}
                      onChange={(event) => setActualFault(event.target.value)}
                    >
                      {[
                        "Normal_1",
                        "Ball_007_1",
                        "Ball_014_1",
                        "Ball_021_1",
                        "IR_007_1",
                        "IR_014_1",
                        "IR_021_1",
                        "OR_007_6_1",
                        "OR_014_6_1",
                        "OR_021_6_1",
                      ].map((label) => (
                        <option value={label} key={label}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="form-actions">
                    <button className="primary-button" type="submit" disabled={loading}>
                      {loading ? "Evaluating..." : "Compare actual vs predicted"}
                    </button>
                  </div>
                </form>

                {evaluationResult && (
                  <div
                    className={`result-message ${
                      evaluationResult.correct ? "success" : "error"
                    }`}
                    role="status"
                  >
                    <span className="result-kicker">LABELLED SAMPLE EVALUATION</span>
                    <strong>
                      {evaluationResult.correct ? "Correct classification" : "Misclassification"}
                    </strong>
                    <span>Actual: {evaluationResult.actual_fault}</span>
                    <span>Predicted: {evaluationResult.predicted_fault}</span>
                    <span>
                      Predicted-class probability:{" "}
                      {(evaluationResult.predicted_class_probability * 100).toFixed(1)}%
                    </span>
                  </div>
                )}
              </section>
  
                
              <section className="panel history-panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">RECENT INFERENCE</p>
                    <h2>Prediction history</h2>
                    <p>The five most recent successful predictions in this browser session.</p>
                  </div>

                  {predictionHistory.length > 0 && (
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => setPredictionHistory([])}
                    >
                      Clear history
                    </button>
                  )}
                </div>

                {predictionHistory.length === 0 ? (
                  <div className="history-empty">
                    <span className="history-empty-icon">⌁</span>
                    <strong>No predictions yet</strong>
                    <span>Run a prediction to populate this history.</span>
                  </div>
                ) : (
                  <div className="history-list">
                    {predictionHistory.map((item, index) => (
                      <div className="history-row" key={item.id}>
                        <span className="history-index">
                          {String(index + 1).padStart(2, "0")}
                        </span>

                        <div className="history-fault">
                          <strong>{item.fault.replaceAll("_", " ")}</strong>
                          <span>{item.time}</span>
                        </div>

                        <span className={`fault-badge ${item.categoryClass}`}>
                          {item.category}
                        </span>

                        <span className="history-probability">
                          {typeof item.probability === "number"
                            ? `${(item.probability * 100).toFixed(1)}%`
                            : "N/A"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </section>

                <div className="feature-grid">
                  {Object.entries(features).map(([key, value]) => (
                    <label className="feature-field" key={key}>
                      <span>{featureLabels[key]}</span>
                      <input
                        type="number"
                        step="any"
                        required
                        value={value}
                        name={key}
                        onChange={(event) => {
                          setFeatures((current) => ({
                            ...current,
                            [key]: event.target.value,
                          }));
                          setPrediction("");
                          setError("");
                        }}
                      />
                    </label>
                  ))}
                </div>

                <div className="form-actions">
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={resetFeatures}
                  >
                    Reset values
                  </button>
                  <button
                    className="primary-button"
                    type="submit"
                    disabled={loading}
                  >
                    {loading ? "Analyzing..." : "Run prediction  →"}
                  </button>
                </div>
              </form>

              {error && (
                <div className="result-message error" role="alert">
                  <strong>Request issue</strong>
                  <span>{error}</span>
                </div>
              )}

              {prediction && (
                
              <div className="result-message success" role="status">
                <span className="result-kicker">
                    PREDICTED BEARING CONDITION
                </span>

              <div className="prediction-result-heading">
                <strong>{prediction.replaceAll("_", " ")}</strong>
                <span className={`fault-badge ${getFaultCategory(prediction).className}`}>
                  {getFaultCategory(prediction).label}
                </span>
              </div>

              {typeof predictionHistory[0]?.probability === "number" && (
                <div className="probability-block">
                  <div className="probability-label">
                    <span>Predicted-class probability</span>
                    <strong>
                      {(predictionHistory[0].probability * 100).toFixed(1)}%
                    </strong>
                  </div>

                  <div className="probability-track">
                    <span
                      style={{
                        width: `${Math.max(
                          0,
                          Math.min(100, predictionHistory[0].probability * 100)
                        )}%`,
                      }}
                    />
                  </div>

                  <small>
                    Uncalibrated Random Forest probability; not a guarantee of correctness.
                  </small>
                </div>
              )}

              <span>
                Model inference completed successfully. This is a predicted class,
                not a confirmed physical diagnosis.
              </span>
            </div>
          )}

             
            </article>

            <article className="panel signal-panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">SIGNAL INTELLIGENCE</p>
                  <h2>Feature overview</h2>
                  <p>Understand the values supplied to the classifier.</p>
                </div>
              </div>

              <div
                className="signal-visual"
                role="img"
                aria-label="Illustrative concentric technical visualization"
              >
                <div className="signal-orbit orbit-one" />
                <div className="signal-orbit orbit-two" />
                <div className="signal-orbit orbit-three" />
                <div className="signal-core">
                  <span>ML</span>
                  <small>ENGINE</small>
                </div>
                <div className="signal-node node-one" />
                <div className="signal-node node-two" />
                <div className="signal-node node-three" />
                <div className="signal-node node-four" />
              </div>

              <div className="signal-legend">
                <span>
                  <i className="legend-dot blue-dot" /> Amplitude
                </span>
                <span>
                  <i className="legend-dot purple-dot" /> Distribution
                </span>
                <span>
                  <i className="legend-dot orange-dot" /> Shape factors
                </span>
              </div>

              <div className="feature-summary">
                <div>
                  <span>Amplitude statistics</span>
                  <strong>max · min · mean · sd · rms</strong>
                </div>
                <div>
                  <span>Distribution</span>
                  <strong>skewness · kurtosis</strong>
                </div>
                <div>
                  <span>Signal shape</span>
                  <strong>crest · form</strong>
                </div>
              </div>

              <div className="model-note">
                <span className="note-icon" aria-hidden="true">
                  i
                </span>
                <p>
                  This model expects engineered features, not raw sensor
                  readings. The signal-processing stage must calculate these
                  features before inference.
                </p>
              </div>
            </article>
          </section>

          <footer className="page-footer">
            <span>CYBERPULSE · PHYSICAL ML MODULE</span>
            <span>
              Test accuracy is from the existing split; live telemetry is not
              connected.
            </span>
          </footer>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
