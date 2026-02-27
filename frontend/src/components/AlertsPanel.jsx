import { useState } from 'react';
import {
    AlertTriangle, AlertCircle, CheckCircle, ChevronDown, ChevronUp,
    Bell, ShieldAlert, ArrowRight, Lightbulb, Clock, Zap,
} from 'lucide-react';
import './AlertsPanel.css';

const PRIORITY_CONFIG = {
    high: { icon: ShieldAlert, color: '#ef4444', bg: 'rgba(239, 68, 68, 0.08)', label: 'HIGH' },
    medium: { icon: AlertTriangle, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.08)', label: 'MEDIUM' },
    low: { icon: Lightbulb, color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.08)', label: 'LOW' },
};

const ALERT_TYPE_CONFIG = {
    critical: { icon: AlertCircle, color: '#ef4444' },
    warning: { icon: AlertTriangle, color: '#f59e0b' },
};

export default function AlertsPanel({ alerts, recommendations }) {
    const [expandedRec, setExpandedRec] = useState(null);
    const [showAllAlerts, setShowAllAlerts] = useState(false);

    if (!alerts && !recommendations) return null;

    const displayAlerts = showAllAlerts ? alerts : alerts?.slice(0, 5);
    const criticalCount = alerts?.filter(a => a.type === 'critical').length || 0;
    const warningCount = alerts?.filter(a => a.type === 'warning').length || 0;

    return (
        <div className="alerts-panel-container">
            {/* Alerts Section */}
            {alerts && alerts.length > 0 && (
                <div className="alerts-section glass-card animate-fade-in" id="alerts-section">
                    <div className="alerts-header">
                        <div className="alerts-title">
                            <Bell size={18} />
                            <h3>Real-Time Alerts</h3>
                        </div>
                        <div className="alert-counts">
                            {criticalCount > 0 && (
                                <span className="alert-count critical">
                                    <AlertCircle size={12} />
                                    {criticalCount} Critical
                                </span>
                            )}
                            {warningCount > 0 && (
                                <span className="alert-count warning">
                                    <AlertTriangle size={12} />
                                    {warningCount} Warning
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="alerts-list">
                        {displayAlerts.map((alert, idx) => {
                            const config = ALERT_TYPE_CONFIG[alert.type] || ALERT_TYPE_CONFIG.warning;
                            const Icon = config.icon;
                            return (
                                <div key={idx} className={`alert-item ${alert.type}`}>
                                    <div className="alert-icon" style={{ color: config.color }}>
                                        <Icon size={16} />
                                    </div>
                                    <div className="alert-content">
                                        <div className="alert-title">{alert.title}</div>
                                        <div className="alert-details">
                                            <span className="alert-value">Current: {alert.value}</span>
                                            <span className="alert-target">Target: {alert.target}</span>
                                        </div>
                                    </div>
                                    <span className="alert-time">
                                        <Clock size={10} />
                                        {alert.timestamp}
                                    </span>
                                </div>
                            );
                        })}
                    </div>

                    {alerts.length > 5 && (
                        <button
                            className="show-more-btn"
                            onClick={() => setShowAllAlerts(!showAllAlerts)}
                            id="show-more-alerts-btn"
                        >
                            {showAllAlerts ? (
                                <>Show Less <ChevronUp size={14} /></>
                            ) : (
                                <>Show All ({alerts.length}) <ChevronDown size={14} /></>
                            )}
                        </button>
                    )}
                </div>
            )}

            {/* Recommendations Section */}
            {recommendations && recommendations.length > 0 && (
                <div className="recommendations-section glass-card animate-fade-in" id="recommendations-section">
                    <div className="recommendations-header">
                        <div className="recommendations-title">
                            <Zap size={18} />
                            <h3>Actionable Recommendations</h3>
                        </div>
                        <span className="rec-count">{recommendations.length} items</span>
                    </div>

                    <div className="recommendations-list">
                        {recommendations.map((rec, idx) => {
                            const config = PRIORITY_CONFIG[rec.priority] || PRIORITY_CONFIG.low;
                            const Icon = config.icon;
                            const isExpanded = expandedRec === idx;

                            return (
                                <div
                                    key={idx}
                                    className={`recommendation-item ${isExpanded ? 'expanded' : ''}`}
                                    onClick={() => setExpandedRec(isExpanded ? null : idx)}
                                    id={`recommendation-${idx}`}
                                >
                                    <div className="rec-header">
                                        <div className="rec-icon" style={{ background: config.bg, color: config.color }}>
                                            <Icon size={16} />
                                        </div>
                                        <div className="rec-main">
                                            <div className="rec-title-row">
                                                <span className="rec-title">{rec.title}</span>
                                                <span
                                                    className="rec-priority"
                                                    style={{ color: config.color, borderColor: config.color }}
                                                >
                                                    {config.label}
                                                </span>
                                            </div>
                                            <span className="rec-category">{rec.category}</span>
                                        </div>
                                        <ChevronDown
                                            size={16}
                                            className={`rec-chevron ${isExpanded ? 'rotated' : ''}`}
                                        />
                                    </div>

                                    {isExpanded && (
                                        <div className="rec-details animate-fade-in">
                                            <p className="rec-description">{rec.description}</p>
                                            <div className="rec-meta">
                                                <div className="rec-meta-item">
                                                    <AlertTriangle size={12} />
                                                    <span><strong>Impact:</strong> {rec.impact}</span>
                                                </div>
                                                <div className="rec-meta-item action">
                                                    <ArrowRight size={12} />
                                                    <span><strong>Action:</strong> {rec.action}</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* No Issues State */}
            {(!alerts || alerts.length === 0) && (!recommendations || recommendations.length === 0) && (
                <div className="no-alerts glass-card">
                    <CheckCircle size={40} />
                    <h3>All Clear</h3>
                    <p>No alerts or recommendations at this time. Shelf conditions are optimal.</p>
                </div>
            )}
        </div>
    );
}
