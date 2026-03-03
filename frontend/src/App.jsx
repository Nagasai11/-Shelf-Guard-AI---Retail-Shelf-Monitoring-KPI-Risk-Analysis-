import { useState, useEffect } from 'react';
import {
  BarChart3, ShieldCheck, Upload, Activity, Clock, Store,
  RefreshCw, CheckCircle, AlertTriangle, WifiOff, Wifi, Shield,
  LogOut, Settings,
} from 'lucide-react';
import ImageUpload from './components/ImageUpload';
import DetectionCanvas from './components/DetectionCanvas';
import KPIDashboard from './components/KPIDashboard';
import AlertsPanel from './components/AlertsPanel';
import HistoryPage from './components/HistoryPage';
import AdminDashboard from './components/AdminDashboard';
import LoginPage from './components/LoginPage';
import {
  analyzeShelfImage, getHealth, loginUser, registerUser,
  logoutUser, getStores, getToken, setToken, setLogoutCallback,
} from './services/api';
import './App.css';

const TABS = [
  { id: 'upload', label: 'Upload & Detect', icon: Upload },
  { id: 'dashboard', label: 'KPI Dashboard', icon: BarChart3 },
  { id: 'alerts', label: 'Alerts & Actions', icon: Activity },
  { id: 'history', label: 'History & Trends', icon: Clock },
  { id: 'admin', label: 'Admin', icon: Shield, adminOnly: true },
];

function App() {
  const [activeTab, setActiveTab] = useState('upload');
  const [isLoading, setIsLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [error, setError] = useState(null);
  const [serverStatus, setServerStatus] = useState('checking');
  const [analysisCount, setAnalysisCount] = useState(0);

  // Auth state — NO demo mode
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  // Store & detection mode
  const [stores, setStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState('');
  const [detectionMode, setDetectionMode] = useState('opencv');

  // Register the logout callback so 401 responses auto-redirect to login
  useEffect(() => {
    setLogoutCallback(() => {
      setUser(null);
      setAnalysisResult(null);
      setActiveTab('upload');
    });
  }, []);

  // On mount, check if we have a valid token
  useEffect(() => {
    const token = getToken();
    if (token) {
      import('./services/api').then(({ getCurrentUser }) => {
        getCurrentUser()
          .then((data) => {
            if (data.user) {
              setUser(data.user);
            } else {
              setToken(null);
            }
          })
          .catch(() => {
            setToken(null);
          })
          .finally(() => {
            setAuthChecked(true);
          });
      });
    } else {
      setAuthChecked(true);
    }
  }, []);

  // Load stores after login
  useEffect(() => {
    if (user) {
      getStores()
        .then((data) => setStores(data.stores || []))
        .catch(() => { });
    }
  }, [user]);

  // Check server health
  useEffect(() => {
    let cancelled = false;

    const checkHealthWithRetry = async (retries = 5, delay = 3000) => {
      for (let i = 0; i < retries; i++) {
        if (cancelled) return;
        try {
          await getHealth();
          if (!cancelled) setServerStatus('connected');
          return;
        } catch {
          if (!cancelled) {
            setServerStatus(i < retries - 1 ? 'waking' : 'disconnected');
          }
          if (i < retries - 1) {
            await new Promise((r) => setTimeout(r, delay));
          }
        }
      }
    };

    checkHealthWithRetry();
    const interval = setInterval(() => checkHealthWithRetry(2, 2000), 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const handleLogin = async (mode, credentials) => {
    if (mode === 'login') {
      const data = await loginUser(credentials);
      setUser(data.user);
    } else {
      const data = await registerUser(credentials);
      setUser(data.user);
    }
  };

  const handleLogout = async () => {
    await logoutUser();
    setUser(null);
    setAnalysisResult(null);
    setActiveTab('upload');
  };

  const handleAnalyze = async (file) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await analyzeShelfImage(file, detectionMode, selectedStore || null);
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

  // Show loading while checking auth
  if (!authChecked) {
    return (
      <div className="app-root">
        <div className="bg-gradient-orb orb-1" />
        <div className="bg-gradient-orb orb-2" />
        <div className="auth-loading">
          <div className="loading-spinner" />
          <p>Checking authentication...</p>
        </div>
      </div>
    );
  }

  // NOT LOGGED IN → Force login page (no bypass, no demo)
  if (!user) {
    return <LoginPage onLogin={handleLogin} />;
  }

  const isAdmin = user.role === 'admin';

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
          {/* Store Selector */}
          {stores.length > 0 && (
            <select
              className="store-selector"
              value={selectedStore}
              onChange={(e) => setSelectedStore(e.target.value)}
              title="Select Store"
            >
              <option value="">All Stores</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>{s.store_name}</option>
              ))}
            </select>
          )}

          {/* Detection Mode Toggle */}
          <div className="detection-mode-toggle" title="Detection Mode">
            <Settings size={12} />
            <select
              value={detectionMode}
              onChange={(e) => setDetectionMode(e.target.value)}
            >
              <option value="opencv">OpenCV</option>
              <option value="yolov8">YOLOv8</option>
            </select>
          </div>

          <div className={`server-status ${serverStatus}`}>
            {serverStatus === 'connected' ? <Wifi size={12} /> : <WifiOff size={12} />}
            <span>
              {serverStatus === 'connected' ? 'API Connected'
                : serverStatus === 'waking' ? 'Waking up...'
                  : 'API Offline'}
            </span>
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

          {/* User info + Logout */}
          <div className="user-menu">
            <span className="user-badge">
              <Shield size={12} />
              {user.username} ({user.role})
            </span>
            <button className="logout-btn" onClick={handleLogout} title="Sign Out">
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="tab-nav" id="tab-nav">
        <div className="tab-list">
          {TABS.map((tab) => {
            if (tab.adminOnly && !isAdmin) return null;
            const Icon = tab.icon;
            const isDisabled = ['dashboard', 'alerts'].includes(tab.id) && !analysisResult;
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
              <p className="loading-mode">Using: {detectionMode === 'yolov8' ? 'YOLOv8 Advanced' : 'OpenCV Standard'}</p>
              <div className="loading-steps">
                <div className="loading-step active">
                  <div className="step-dot" />
                  <span>Running Object Detection ({detectionMode === 'yolov8' ? 'YOLOv8' : 'OpenCV'})</span>
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

              {/* Feature Highlights */}
              {!analysisResult && !isLoading && (
                <div className="features-grid">
                  <div className="feature-card glass-card animate-fade-in stagger-1">
                    <div className="feature-icon" style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#818cf8' }}>
                      <BarChart3 size={24} />
                    </div>
                    <h4>Object Detection</h4>
                    <p>YOLOv8 & OpenCV powered product detection with bounding box visualization</p>
                  </div>
                  <div className="feature-card glass-card animate-fade-in stagger-2">
                    <div className="feature-icon" style={{ background: 'rgba(6, 182, 212, 0.1)', color: '#22d3ee' }}>
                      <Activity size={24} />
                    </div>
                    <h4>KPI Analytics</h4>
                    <p>Track 9 KPIs including shelf occupancy, planogram compliance, and revenue at risk</p>
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
                    <h4>Your Data</h4>
                    <p>All uploads, KPIs, and reports are private to your account — secure and isolated</p>
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

          {activeTab === 'history' && (
            <div className="content-section">
              <HistoryPage stores={stores} selectedStore={selectedStore} />
            </div>
          )}

          {activeTab === 'admin' && isAdmin && (
            <div className="content-section">
              <AdminDashboard />
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="app-footer" id="app-footer">
        <span>ShelfGuard AI v2.0 — Retail Shelf Monitoring & KPI Risk Analysis System</span>
        <span className="footer-tech">React · Flask · OpenCV · YOLOv8 · Random Forest · PostgreSQL · JWT</span>
      </footer>
    </div>
  );
}

export default App;
