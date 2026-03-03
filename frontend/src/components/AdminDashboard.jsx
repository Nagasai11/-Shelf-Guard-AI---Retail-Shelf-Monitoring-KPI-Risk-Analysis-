import { useState, useEffect } from 'react';
import {
    Shield, Upload, Users, Store, TrendingUp, BarChart3, Activity
} from 'lucide-react';
import {
    PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { getAdminAnalytics } from '../services/api';
import AuditLogView from './AuditLogView';
import './AdminDashboard.css';

const RISK_COLORS = { Low: '#34d399', Medium: '#fbbf24', High: '#f87171' };

export default function AdminDashboard() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeSection, setActiveSection] = useState('overview'); // overview | audit

    useEffect(() => {
        fetchAnalytics();
    }, []);

    const fetchAnalytics = async () => {
        setLoading(true);
        try {
            const result = await getAdminAnalytics();
            setData(result);
        } catch {
            setData(null);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="admin-loading">Loading admin analytics...</div>;
    if (!data) return <div className="admin-loading">Failed to load analytics data.</div>;

    const riskPieData = Object.entries(data.risk_distribution || {}).map(([name, value]) => ({
        name, value, fill: RISK_COLORS[name]
    }));

    const featureData = (data.avg_feature_importance || []).map(f => ({
        name: f.feature.replace(' ', '\n'),
        importance: Math.round(f.importance * 100),
    }));

    const confData = Object.entries(data.confidence_distribution || {}).map(([range, count]) => ({
        range, count,
    }));

    return (
        <div className="admin-dashboard">
            <div className="admin-header">
                <div className="admin-title">
                    <Shield size={22} />
                    <h2>Admin Analytics</h2>
                </div>
                <div className="admin-tabs">
                    <button className={`admin-tab ${activeSection === 'overview' ? 'active' : ''}`}
                        onClick={() => setActiveSection('overview')}>
                        <BarChart3 size={14} /> Overview
                    </button>
                    <button className={`admin-tab ${activeSection === 'audit' ? 'active' : ''}`}
                        onClick={() => setActiveSection('audit')}>
                        <Activity size={14} /> Audit Logs
                    </button>
                </div>
            </div>

            {activeSection === 'overview' ? (
                <>
                    {/* Summary Cards */}
                    <div className="admin-summary">
                        <div className="summary-card glass-card">
                            <Upload size={20} />
                            <div>
                                <span className="summary-value">{data.total_uploads}</span>
                                <span className="summary-label">Total Uploads</span>
                            </div>
                        </div>
                        <div className="summary-card glass-card">
                            <Users size={20} />
                            <div>
                                <span className="summary-value">{data.total_users}</span>
                                <span className="summary-label">Registered Users</span>
                            </div>
                        </div>
                        <div className="summary-card glass-card">
                            <Store size={20} />
                            <div>
                                <span className="summary-value">{data.total_stores}</span>
                                <span className="summary-label">Stores</span>
                            </div>
                        </div>
                        <div className="summary-card glass-card">
                            <TrendingUp size={20} />
                            <div>
                                <span className="summary-value">
                                    {data.avg_risk_score ? `${(data.avg_risk_score * 100).toFixed(1)}%` : 'N/A'}
                                </span>
                                <span className="summary-label">Avg Confidence</span>
                            </div>
                        </div>
                    </div>

                    {/* Average KPIs */}
                    <div className="admin-avg-kpis glass-card">
                        <h3>Average KPI Values</h3>
                        <div className="avg-kpi-grid">
                            <div className="avg-kpi-item">
                                <span className="avg-kpi-val">{data.avg_kpis?.occupancy || 0}%</span>
                                <span className="avg-kpi-label">Avg Occupancy</span>
                            </div>
                            <div className="avg-kpi-item">
                                <span className="avg-kpi-val">{data.avg_kpis?.empty_severity || 0}%</span>
                                <span className="avg-kpi-label">Avg Empty Severity</span>
                            </div>
                            <div className="avg-kpi-item">
                                <span className="avg-kpi-val">${data.avg_kpis?.revenue_at_risk || 0}</span>
                                <span className="avg-kpi-label">Avg Revenue at Risk</span>
                            </div>
                            <div className="avg-kpi-item">
                                <span className="avg-kpi-val">{data.avg_kpis?.planogram_compliance || 0}%</span>
                                <span className="avg-kpi-label">Avg Planogram Compliance</span>
                            </div>
                        </div>
                    </div>

                    {/* Charts Row */}
                    <div className="admin-charts">
                        <div className="glass-card chart-card">
                            <h3>Risk Distribution</h3>
                            {riskPieData.length > 0 ? (
                                <ResponsiveContainer width="100%" height={250}>
                                    <PieChart>
                                        <Pie data={riskPieData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                                            outerRadius={80} innerRadius={40} paddingAngle={3}>
                                            {riskPieData.map((entry, i) => (
                                                <Cell key={i} fill={entry.fill} />
                                            ))}
                                        </Pie>
                                        <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <p className="no-data">No data yet</p>
                            )}
                        </div>

                        <div className="glass-card chart-card">
                            <h3>Feature Importance (Avg)</h3>
                            {featureData.length > 0 ? (
                                <ResponsiveContainer width="100%" height={250}>
                                    <BarChart data={featureData} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                        <XAxis type="number" stroke="#64748b" fontSize={11} />
                                        <YAxis type="category" dataKey="name" stroke="#64748b" fontSize={9} width={80} />
                                        <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} />
                                        <Bar dataKey="importance" fill="#818cf8" radius={[0, 4, 4, 0]} name="Importance %" />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <p className="no-data">No data yet</p>
                            )}
                        </div>

                        <div className="glass-card chart-card">
                            <h3>Model Confidence Distribution</h3>
                            {confData.length > 0 ? (
                                <ResponsiveContainer width="100%" height={250}>
                                    <BarChart data={confData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                        <XAxis dataKey="range" stroke="#64748b" fontSize={11} />
                                        <YAxis stroke="#64748b" fontSize={11} />
                                        <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} />
                                        <Bar dataKey="count" fill="#22d3ee" radius={[4, 4, 0, 0]} name="Analyses" />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <p className="no-data">No data yet</p>
                            )}
                        </div>
                    </div>
                </>
            ) : (
                <AuditLogView />
            )}
        </div>
    );
}
