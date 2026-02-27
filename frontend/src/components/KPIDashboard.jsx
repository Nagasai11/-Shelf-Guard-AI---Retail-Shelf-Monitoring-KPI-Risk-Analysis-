import { useMemo } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, RadialBarChart, RadialBar, Legend,
    AreaChart, Area, LineChart, Line,
} from 'recharts';
import {
    TrendingUp, TrendingDown, AlertTriangle, CheckCircle,
    Target, BarChart3, Activity, ShieldAlert, DollarSign,
    Package, ArrowUpRight, ArrowDownRight, Minus,
} from 'lucide-react';
import './KPIDashboard.css';

const STATUS_COLORS = {
    healthy: '#10b981',
    warning: '#f59e0b',
    critical: '#ef4444',
};

const RISK_COLORS = ['#10b981', '#f59e0b', '#ef4444'];
const CHART_COLORS = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#f97316'];

export default function KPIDashboard({ kpiAnalysis, salesData, historical }) {
    if (!kpiAnalysis) return null;

    const { kpis, risk_prediction, revenue_impact } = kpiAnalysis;

    const kpiCards = useMemo(() => [
        { key: 'shelf_occupancy', icon: Package, ...kpis.shelf_occupancy },
        { key: 'empty_slot_severity', icon: AlertTriangle, ...kpis.empty_slot_severity },
        { key: 'shelf_imbalance', icon: BarChart3, ...kpis.shelf_imbalance },
        { key: 'misplacement_rate', icon: Target, ...kpis.misplacement_rate },
        { key: 'product_density', icon: Activity, ...kpis.product_density },
        { key: 'sell_through_rate', icon: TrendingUp, ...kpis.sell_through_rate },
        { key: 'stockout_probability', icon: ShieldAlert, ...kpis.stockout_probability },
        { key: 'revenue_at_risk', icon: DollarSign, ...kpis.revenue_at_risk },
    ], [kpis]);

    // Risk gauge data
    const riskGaugeData = [
        { name: 'Low', value: risk_prediction.probabilities.low * 100, fill: '#10b981' },
        { name: 'Medium', value: risk_prediction.probabilities.medium * 100, fill: '#f59e0b' },
        { name: 'High', value: risk_prediction.probabilities.high * 100, fill: '#ef4444' },
    ];

    // Feature importance data
    const featureData = risk_prediction.feature_importance.map((f, i) => ({
        name: f.feature.replace(' ', '\n'),
        shortName: f.feature.split(' ')[0],
        importance: (f.importance * 100).toFixed(1),
        fill: CHART_COLORS[i % CHART_COLORS.length],
    }));

    // Category revenue data
    const categoryData = salesData?.category_metrics
        ? Object.entries(salesData.category_metrics).map(([cat, data]) => ({
            name: cat,
            revenue: data.weekly_revenue,
            margin: (data.profit_margin * 100).toFixed(1),
            shelfCount: data.shelf_count,
        }))
        : [];

    // Historical trends
    const occupancyTrend = historical?.occupancy_history?.slice(-14) || [];
    const revenueTrend = historical?.revenue_history?.slice(-14) || [];

    const getStatusIcon = (status) => {
        switch (status) {
            case 'healthy': return <CheckCircle size={14} />;
            case 'warning': return <AlertTriangle size={14} />;
            case 'critical': return <ShieldAlert size={14} />;
            default: return <Minus size={14} />;
        }
    };

    const getTrendIcon = (kpiKey) => {
        const value = kpis[kpiKey]?.value || 0;
        const target = kpis[kpiKey]?.target || 0;
        if (value >= target) return <ArrowUpRight size={12} style={{ color: '#10b981' }} />;
        if (value >= target * 0.8) return <Minus size={12} style={{ color: '#f59e0b' }} />;
        return <ArrowDownRight size={12} style={{ color: '#ef4444' }} />;
    };

    const CustomTooltip = ({ active, payload, label }) => {
        if (!active || !payload?.length) return null;
        return (
            <div className="chart-tooltip">
                <p className="tooltip-label">{label}</p>
                {payload.map((entry, idx) => (
                    <p key={idx} style={{ color: entry.color || entry.fill }}>
                        {entry.name}: {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
                    </p>
                ))}
            </div>
        );
    };

    return (
        <div className="dashboard-container">
            {/* Risk Overview Header */}
            <div className={`risk-overview glass-card risk-${risk_prediction.overall_risk.toLowerCase()}`} id="risk-overview">
                <div className="risk-overview-left">
                    <div className="risk-level-badge">
                        <ShieldAlert size={20} />
                        <span>Overall Risk</span>
                    </div>
                    <div className="risk-level-value">
                        {risk_prediction.overall_risk}
                    </div>
                    <div className="risk-confidence">
                        Model Confidence: {(risk_prediction.model_info.confidence * 100).toFixed(1)}%
                        <span className="risk-model-tag">{risk_prediction.model_info.algorithm}</span>
                    </div>
                </div>

                <div className="risk-probabilities">
                    {riskGaugeData.map((item) => (
                        <div key={item.name} className="risk-prob-item">
                            <div className="risk-prob-bar-bg">
                                <div
                                    className="risk-prob-bar-fill"
                                    style={{ width: `${item.value}%`, background: item.fill }}
                                />
                            </div>
                            <div className="risk-prob-label">
                                <span style={{ color: item.fill }}>{item.name}</span>
                                <span>{item.value.toFixed(1)}%</span>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="revenue-impact-card">
                    <DollarSign size={18} />
                    <div>
                        <span className="revenue-label">Revenue at Risk</span>
                        <span className="revenue-value">${revenue_impact.revenue_at_risk.toLocaleString()}</span>
                        <span className="revenue-recovery">
                            Potential Recovery: ${revenue_impact.potential_recovery.toLocaleString()}
                        </span>
                    </div>
                </div>
            </div>

            {/* KPI Cards Grid */}
            <div className="kpi-grid">
                {kpiCards.map((kpi, idx) => {
                    const Icon = kpi.icon;
                    return (
                        <div
                            key={kpi.key}
                            className={`kpi-card glass-card animate-fade-in stagger-${idx + 1}`}
                            id={`kpi-card-${kpi.key}`}
                        >
                            <div className="kpi-card-header">
                                <div className={`kpi-icon status-${kpi.status}`}>
                                    <Icon size={16} />
                                </div>
                                <span className={`status-badge ${kpi.status}`}>
                                    {getStatusIcon(kpi.status)}
                                    {kpi.status}
                                </span>
                            </div>
                            <div className="kpi-card-value">
                                <span className="kpi-number">
                                    {kpi.unit === '$' ? '$' : ''}{kpi.value}
                                </span>
                                {kpi.unit !== '$' && <span className="kpi-unit">{kpi.unit}</span>}
                                {getTrendIcon(kpi.key)}
                            </div>
                            <div className="kpi-card-label">{kpi.description}</div>
                            <div className="kpi-progress-bar">
                                <div
                                    className={`kpi-progress-fill status-${kpi.status}`}
                                    style={{
                                        '--progress': `${Math.min(100, (kpi.value / Math.max(kpi.target, 1)) * 100)}%`,
                                        width: `${Math.min(100, (kpi.value / Math.max(kpi.target, 1)) * 100)}%`,
                                    }}
                                />
                            </div>
                            <div className="kpi-target">Target: {kpi.target}{kpi.unit}</div>
                        </div>
                    );
                })}
            </div>

            {/* Charts Section */}
            <div className="charts-grid">
                {/* Risk Probability Distribution */}
                <div className="chart-card glass-card animate-fade-in">
                    <h4>Risk Probability Distribution</h4>
                    <div className="chart-wrapper">
                        <ResponsiveContainer width="100%" height={230}>
                            <PieChart>
                                <Pie
                                    data={riskGaugeData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={55}
                                    outerRadius={85}
                                    paddingAngle={4}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {riskGaugeData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.fill} />
                                    ))}
                                </Pie>
                                <Tooltip content={<CustomTooltip />} />
                                <Legend
                                    iconType="circle"
                                    iconSize={8}
                                    wrapperStyle={{ fontSize: '0.75rem', color: '#94a3b8' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Feature Importance */}
                <div className="chart-card glass-card animate-fade-in">
                    <h4>Risk Factor Importance (XAI)</h4>
                    <div className="chart-wrapper">
                        <ResponsiveContainer width="100%" height={230}>
                            <BarChart data={featureData} layout="vertical" margin={{ left: 10 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                                <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} />
                                <YAxis
                                    type="category"
                                    dataKey="shortName"
                                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                                    width={80}
                                />
                                <Tooltip content={<CustomTooltip />} />
                                <Bar dataKey="importance" name="Importance %" radius={[0, 4, 4, 0]}>
                                    {featureData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.fill} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Category Revenue Chart */}
                <div className="chart-card glass-card animate-fade-in">
                    <h4>Category Revenue Breakdown</h4>
                    <div className="chart-wrapper">
                        <ResponsiveContainer width="100%" height={230}>
                            <BarChart data={categoryData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                                <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} angle={-20} />
                                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
                                <Tooltip content={<CustomTooltip />} />
                                <Bar dataKey="revenue" name="Weekly Revenue ($)" fill="#6366f1" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Occupancy Trend */}
                <div className="chart-card glass-card animate-fade-in">
                    <h4>Shelf Occupancy Trend (14 Days)</h4>
                    <div className="chart-wrapper">
                        <ResponsiveContainer width="100%" height={230}>
                            <AreaChart data={occupancyTrend}>
                                <defs>
                                    <linearGradient id="occupancyGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                                <XAxis
                                    dataKey="date"
                                    tick={{ fill: '#64748b', fontSize: 10 }}
                                    tickFormatter={(val) => val.slice(5)}
                                />
                                <YAxis
                                    tick={{ fill: '#64748b', fontSize: 11 }}
                                    domain={[0.4, 1]}
                                    tickFormatter={(val) => `${(val * 100).toFixed(0)}%`}
                                />
                                <Tooltip content={<CustomTooltip />} />
                                <Area
                                    type="monotone"
                                    dataKey="value"
                                    name="Occupancy"
                                    stroke="#6366f1"
                                    strokeWidth={2}
                                    fill="url(#occupancyGradient)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
}
