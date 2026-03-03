import { useState, useEffect } from 'react';
import { FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import { getAuditLogs } from '../services/api';
import './AuditLogView.css';

const ACTION_COLORS = {
    login: '#34d399', logout: '#94a3b8', register: '#818cf8',
    upload: '#22d3ee', login_failed: '#f87171', admin_action: '#fbbf24', predict: '#a78bfa',
};

export default function AuditLogView() {
    const [logs, setLogs] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [actionFilter, setActionFilter] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchLogs();
    }, [page, actionFilter]);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const data = await getAuditLogs({ page, action: actionFilter || undefined });
            setLogs(data.logs || []);
            setTotal(data.total || 0);
        } catch {
            setLogs([]);
        } finally {
            setLoading(false);
        }
    };

    const totalPages = Math.max(1, Math.ceil(total / 50));

    return (
        <div className="audit-log-view">
            <div className="audit-header">
                <h3><FileText size={16} /> Audit Logs</h3>
                <div className="audit-filters">
                    <select value={actionFilter} onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}>
                        <option value="">All Actions</option>
                        <option value="login">Login</option>
                        <option value="logout">Logout</option>
                        <option value="register">Register</option>
                        <option value="upload">Upload</option>
                        <option value="login_failed">Login Failed</option>
                        <option value="admin_action">Admin Action</option>
                    </select>
                    <span className="audit-count">{total} entries</span>
                </div>
            </div>

            {loading ? (
                <div className="audit-loading">Loading logs...</div>
            ) : logs.length === 0 ? (
                <div className="audit-empty">No audit log entries found.</div>
            ) : (
                <div className="audit-list">
                    {logs.map((log) => (
                        <div key={log.id} className="audit-entry">
                            <div className="audit-action-badge" style={{
                                background: `${ACTION_COLORS[log.action] || '#94a3b8'}20`,
                                color: ACTION_COLORS[log.action] || '#94a3b8',
                            }}>
                                {log.action}
                            </div>
                            <div className="audit-details">
                                <span className="audit-user">{log.username}</span>
                                <span className="audit-detail-text">{log.details || 'No details'}</span>
                            </div>
                            <div className="audit-meta">
                                <span>{log.ip_address || '—'}</span>
                                <span>{new Date(log.created_at).toLocaleString()}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="pagination">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                    <ChevronLeft size={16} />
                </button>
                <span>Page {page} of {totalPages}</span>
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                    <ChevronRight size={16} />
                </button>
            </div>
        </div>
    );
}
