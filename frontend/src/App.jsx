import { useState, useEffect } from 'react';
import {
  BarChart3, ShieldCheck, Upload, Activity,
  RefreshCw, CheckCircle, AlertTriangle, WifiOff, Wifi, Layers,
} from 'lucide-react';
import ImageUpload from './components/ImageUpload';
import ModelComparison from './components/ModelComparison';
import KPIDashboard from './components/KPIDashboard';
import AlertsPanel from './components/AlertsPanel';
import './App.css';

const API_BASE = import.meta.env.DEV ? 'http://localhost:5000/api' : '/api';

const TABS = [
  { id: 'upload', label: 'Upload & Detect', icon: Upload },
  { id: 'comparison', label: 'Model Comparison', icon: Layers },
  { id: 'dashboard', label: 'KPI & Risk', icon: BarChart3 },
  { id: 'alerts', label: 'Alerts', icon: Activity },
];

function App() {
  const [activeTab, setActiveTab] = useState('upload');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [serverStatus, setServerStatus] = useState('checking');
  const [analysisCount, setAnalysisCount] = useState(0);

  // Health check
  useEffect(() => {
    let cancelled = false;
    const check = async (retries = 5) => {
      for (let i = 0; i < retries; i++) {
        if (cancelled) return;
        try {
          const r = await fetch(`${API_BASE}/health`);
          if (r.ok && !cancelled) { setServerStatus('connected'); return; }
        } catch { /* ignore */ }
        if (!cancelled) setServerStatus(i < retries - 1 ? 'waking' : 'disconnected');
        if (i < retries - 1) await new Promise(r => setTimeout(r, 3000));
      }
    };
    check();
    const interval = setInterval(() => check(2), 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const handleAnalyze = async (file) => {
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const response = await fetch(`${API_BASE}/analyze`, {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Analysis failed');
      }
      const data = await response.json();
      setResult(data);
      setAnalysisCount(c => c + 1);
      setActiveTab('comparison');
    } catch (err) {
      setError(err.message || 'Failed to analyze image');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setError(null);
    setActiveTab('upload');
  };

  return (
    <div className="app-root">
      <div className="bg-gradient-orb orb-1" />
      <div className="bg-gradient-orb orb-2" />
      <div className="bg-gradient-orb orb-3" />

      {/* Header */}
      <header className="app-header" id="app-header">
        <div className="header-left">
          <div className="logo">
            <div className="logo-icon"><ShieldCheck size={22} /></div>
            <div className="logo-text">
              <h1>ShelfRisk<span className="logo-ai">Analyzer</span></h1>
              <span className="logo-subtitle">Dual-Model KPI Risk Comparison</span>
            </div>
          </div>
        </div>
        <div className="header-right">
          <div className={`server-status ${serverStatus}`}>
            {serverStatus === 'connected' ? <Wifi size={12} /> : <WifiOff size={12} />}
            <span>{serverStatus === 'connected' ? 'API Connected' : serverStatus === 'waking' ? 'Waking...' : 'API Offline'}</span>
          </div>
          {result && (
            <div className="analysis-badge">
              <CheckCircle size={12} />
              <span>Analysis #{analysisCount}</span>
            </div>
          )}
          {result && (
            <button className="reset-btn" onClick={handleReset}>
              <RefreshCw size={14} /> New Analysis
            </button>
          )}
        </div>
      </header>

      {/* Tabs */}
      <nav className="tab-nav">
        <div className="tab-list">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const needsResult = ['comparison', 'dashboard', 'alerts'].includes(tab.id);
            const isDisabled = needsResult && !result;
            return (
              <button
                key={tab.id}
                className={`tab-btn ${activeTab === tab.id ? 'active' : ''} ${isDisabled ? 'disabled' : ''}`}
                onClick={() => !isDisabled && setActiveTab(tab.id)}
                disabled={isDisabled}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Main Content */}
      <main className="app-main">
        {error && (
          <div className="error-banner animate-fade-in">
            <AlertTriangle size={18} />
            <div className="error-content">
              <strong>Error</strong>
              <p>{error}</p>
            </div>
            <button onClick={() => setError(null)} className="error-close">×</button>
          </div>
        )}

        {isLoading && (
          <div className="loading-overlay">
            <div className="loading-card glass-card">
              <div className="loading-spinner" />
              <h3>Analyzing Shelf Image</h3>
              <p className="loading-mode">Running dual-model analysis...</p>
              <div className="loading-steps">
                <div className="loading-step active">
                  <div className="step-dot" />
                  <span>YOLOv8: Product Detection & Occupancy</span>
                </div>
                <div className="loading-step pending">
                  <div className="step-dot" />
                  <span>Depth Anything V2: Depth & Hollow Analysis</span>
                </div>
                <div className="loading-step pending">
                  <div className="step-dot" />
                  <span>KPI Comparison Engine</span>
                </div>
                <div className="loading-step pending">
                  <div className="step-dot" />
                  <span>Risk Classification (6-Level)</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="tab-content">
          {activeTab === 'upload' && (
            <div className="content-section">
              <div className="glass-card">
                <ImageUpload onAnalyze={handleAnalyze} isLoading={isLoading} />
              </div>
              {!result && !isLoading && (
                <div className="features-grid">
                  <div className="feature-card glass-card animate-fade-in stagger-1">
                    <div className="feature-icon" style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#818cf8' }}>
                      <BarChart3 size={24} />
                    </div>
                    <h4>YOLOv8 Detection</h4>
                    <p>Product detection, bounding boxes, surface occupancy estimation</p>
                  </div>
                  <div className="feature-card glass-card animate-fade-in stagger-2">
                    <div className="feature-icon" style={{ background: 'rgba(6, 182, 212, 0.1)', color: '#22d3ee' }}>
                      <Layers size={24} />
                    </div>
                    <h4>Depth Anything V2</h4>
                    <p>Depth estimation, rear empty analysis, false fullness detection</p>
                  </div>
                  <div className="feature-card glass-card animate-fade-in stagger-3">
                    <div className="feature-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#34d399' }}>
                      <Activity size={24} />
                    </div>
                    <h4>KPI Comparison</h4>
                    <p>Side-by-side model comparison revealing occupancy discrepancies</p>
                  </div>
                  <div className="feature-card glass-card animate-fade-in stagger-4">
                    <div className="feature-icon" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#fbbf24' }}>
                      <ShieldCheck size={24} />
                    </div>
                    <h4>6-Level Risk</h4>
                    <p>ML-powered risk classification from No Risk to Critical Risk</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'comparison' && result && (
            <div className="content-section">
              <ModelComparison result={result} />
            </div>
          )}

          {activeTab === 'dashboard' && result && (
            <div className="content-section">
              <KPIDashboard result={result} />
            </div>
          )}

          {activeTab === 'alerts' && result && (
            <div className="content-section">
              <AlertsPanel result={result} />
            </div>
          )}
        </div>
      </main>

      <footer className="app-footer">
        <span>ShelfRiskAnalyzer v3.0 — Dual-Model KPI Risk Comparison System</span>
        <span className="footer-tech">React · Flask · YOLOv8 · Depth Anything V2 · Random Forest</span>
      </footer>
    </div>
  );
}

export default App;
