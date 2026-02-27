import { useState, useEffect } from 'react';
import {
  BarChart3, ShieldCheck, Upload, Activity, Clock,
  RefreshCw, CheckCircle, AlertTriangle, WifiOff, Wifi,
} from 'lucide-react';
import ImageUpload from './components/ImageUpload';
import DetectionCanvas from './components/DetectionCanvas';
import KPIDashboard from './components/KPIDashboard';
import AlertsPanel from './components/AlertsPanel';
import { analyzeShelfImage, getHealth } from './services/api';
import './App.css';

const TABS = [
  { id: 'upload', label: 'Upload & Detect', icon: Upload },
  { id: 'dashboard', label: 'KPI Dashboard', icon: BarChart3 },
  { id: 'alerts', label: 'Alerts & Actions', icon: Activity },
];

function App() {
  const [activeTab, setActiveTab] = useState('upload');
  const [isLoading, setIsLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [error, setError] = useState(null);
  const [serverStatus, setServerStatus] = useState('checking');
  const [analysisCount, setAnalysisCount] = useState(0);

  // Check server health
  useEffect(() => {
    const checkHealth = async () => {
      try {
        await getHealth();
        setServerStatus('connected');
      } catch {
        setServerStatus('disconnected');
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleAnalyze = async (file) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await analyzeShelfImage(file);
      setAnalysisResult(result);
      setAnalysisCount((c) => c + 1);
      setActiveTab('dashboard');
    } catch (err) {
      setError(
        err.response?.data?.error ||
        err.message ||
        'Failed to analyze image. Make sure the backend server is running.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setAnalysisResult(null);
    setError(null);
    setActiveTab('upload');
  };

  return (
    <div className="app-root">
      {/* Background Effects */}
      <div className="bg-gradient-orb orb-1" />
      <div className="bg-gradient-orb orb-2" />
      <div className="bg-gradient-orb orb-3" />

      {/* Header */}
      <header className="app-header" id="app-header">
        <div className="header-left">
          <div className="logo">
            <div className="logo-icon">
              <ShieldCheck size={22} />
            </div>
            <div className="logo-text">
              <h1>ShelfGuard<span className="logo-ai">AI</span></h1>
              <span className="logo-subtitle">Retail Shelf Monitor & KPI Risk Analysis</span>
            </div>
          </div>
        </div>

        <div className="header-right">
          <div className={`server-status ${serverStatus}`}>
            {serverStatus === 'connected' ? <Wifi size={12} /> : <WifiOff size={12} />}
            <span>{serverStatus === 'connected' ? 'API Connected' : 'API Offline'}</span>
          </div>

          {analysisResult && (
            <div className="analysis-badge">
              <CheckCircle size={12} />
              <span>Analysis #{analysisCount}</span>
            </div>
          )}

          {analysisResult && (
            <button className="reset-btn" onClick={handleReset} id="reset-btn">
              <RefreshCw size={14} />
              New Analysis
            </button>
          )}
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="tab-nav" id="tab-nav">
        <div className="tab-list">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isDisabled = tab.id !== 'upload' && !analysisResult;
            const alertCount = tab.id === 'alerts' && analysisResult
              ? analysisResult?.kpi_analysis?.alerts?.length || 0
              : 0;

            return (
              <button
                key={tab.id}
                className={`tab-btn ${activeTab === tab.id ? 'active' : ''} ${isDisabled ? 'disabled' : ''}`}
                onClick={() => !isDisabled && setActiveTab(tab.id)}
                disabled={isDisabled}
                id={`tab-${tab.id}`}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
                {alertCount > 0 && (
                  <span className="tab-badge">{alertCount}</span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Main Content */}
      <main className="app-main">
        {/* Error Banner */}
        {error && (
          <div className="error-banner animate-fade-in" id="error-banner">
            <AlertTriangle size={18} />
            <div className="error-content">
              <strong>Analysis Error</strong>
              <p>{error}</p>
            </div>
            <button onClick={() => setError(null)} className="error-close">×</button>
          </div>
        )}

        {/* Loading Overlay */}
        {isLoading && (
          <div className="loading-overlay" id="loading-overlay">
            <div className="loading-card glass-card">
              <div className="loading-spinner" />
              <h3>Analyzing Shelf Image</h3>
              <div className="loading-steps">
                <div className="loading-step active">
                  <div className="step-dot" />
                  <span>Running Object Detection (YOLOv8)</span>
                </div>
                <div className="loading-step pending">
                  <div className="step-dot" />
                  <span>Extracting Visual Signals</span>
                </div>
                <div className="loading-step pending">
                  <div className="step-dot" />
                  <span>Fusing with Sales Data</span>
                </div>
                <div className="loading-step pending">
                  <div className="step-dot" />
                  <span>Computing KPI Risk Prediction</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab Content */}
        <div className="tab-content">
          {activeTab === 'upload' && (
            <div className="content-section">
              <div className="glass-card">
                <ImageUpload onAnalyze={handleAnalyze} isLoading={isLoading} />
              </div>

              {analysisResult && (
                <div className="glass-card" style={{ marginTop: 'var(--space-xl)' }}>
                  <DetectionCanvas detection={analysisResult.detection} />
                </div>
              )}

              {/* Feature Highlights (shown when no result yet) */}
              {!analysisResult && !isLoading && (
                <div className="features-grid">
                  <div className="feature-card glass-card animate-fade-in stagger-1">
                    <div className="feature-icon" style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#818cf8' }}>
                      <BarChart3 size={24} />
                    </div>
                    <h4>Object Detection</h4>
                    <p>YOLOv8 & Deformable DETR powered product detection with bounding box visualization</p>
                  </div>
                  <div className="feature-card glass-card animate-fade-in stagger-2">
                    <div className="feature-icon" style={{ background: 'rgba(6, 182, 212, 0.1)', color: '#22d3ee' }}>
                      <Activity size={24} />
                    </div>
                    <h4>KPI Analytics</h4>
                    <p>Track shelf occupancy, empty slots, product density, and revenue at risk</p>
                  </div>
                  <div className="feature-card glass-card animate-fade-in stagger-3">
                    <div className="feature-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#34d399' }}>
                      <ShieldCheck size={24} />
                    </div>
                    <h4>Risk Prediction</h4>
                    <p>Random Forest ML model classifies risk levels with explainable feature importance</p>
                  </div>
                  <div className="feature-card glass-card animate-fade-in stagger-4">
                    <div className="feature-icon" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#fbbf24' }}>
                      <Clock size={24} />
                    </div>
                    <h4>Real-Time Alerts</h4>
                    <p>Instant notifications for critical shelf conditions with actionable recommendations</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'dashboard' && analysisResult && (
            <div className="content-section">
              <KPIDashboard
                kpiAnalysis={analysisResult.kpi_analysis}
                salesData={analysisResult.sales_data}
                historical={analysisResult.historical}
              />
            </div>
          )}

          {activeTab === 'alerts' && analysisResult && (
            <div className="content-section">
              <AlertsPanel
                alerts={analysisResult.kpi_analysis?.alerts}
                recommendations={analysisResult.kpi_analysis?.recommendations}
              />
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="app-footer" id="app-footer">
        <span>ShelfGuard AI — Retail Shelf Monitoring & KPI Risk Analysis System</span>
        <span className="footer-tech">React · Flask · YOLOv8 · Random Forest · OpenCV</span>
      </footer>
    </div>
  );
}

export default App;
