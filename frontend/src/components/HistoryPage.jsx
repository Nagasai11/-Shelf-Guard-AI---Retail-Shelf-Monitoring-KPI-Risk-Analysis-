import { useState, useEffect, useMemo } from 'react';
import {
    Clock, Download, Filter, TrendingUp, Search, ChevronLeft, ChevronRight, FileText,
} from 'lucide-react';
import {
    LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { getHistory } from '../services/api';
import './HistoryPage.css';

export default function HistoryPage({ stores, selectedStore }) {
    const [analyses, setAnalyses] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [riskFilter, setRiskFilter] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const perPage = 20;

    useEffect(() => {
        fetchHistory();
    }, [page, riskFilter, startDate, endDate, selectedStore]);

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const data = await getHistory({
                page,
                per_page: perPage,
                store_id: selectedStore || undefined,
                risk_level: riskFilter || undefined,
                start_date: startDate || undefined,
                end_date: endDate || undefined,
            });
            setAnalyses(data.history || []);
            setTotal(data.total || 0);
        } catch {
            setAnalyses([]);
        } finally {
            setLoading(false);
        }
    };

    // Risk trend data
    const trendData = useMemo(() => {
        return analyses
            .slice()
            .reverse()
            .map((a, i) => ({
                index: i + 1,
                date: a.created_at ? new Date(a.created_at).toLocaleDateString() : `#${i + 1}`,
                risk: a.risk?.level_int ?? 0,
                occupancy: a.kpis?.shelf_occupancy ?? 0,
                compliance: a.kpis?.planogram_compliance ?? 0,
            }));
    }, [analyses]);

    // KPI comparison data
    const kpiCompareData = useMemo(() => {
        if (analyses.length === 0) return [];
        const latest = analyses[0];
        const kpis = latest?.kpis || {};
        return [
            { name: 'Occupancy', value: kpis.shelf_occupancy || 0, target: 85 },
            { name: 'Empty Sev.', value: kpis.empty_severity || 0, target: 10 },
            { name: 'Imbalance', value: kpis.shelf_imbalance || 0, target: 15 },
            { name: 'Misplaced', value: kpis.misplacement_rate || 0, target: 5 },
            { name: 'Density', value: kpis.product_density || 0, target: 8 },
            { name: 'Sell-Thru', value: kpis.sell_through || 0, target: 75 },
            { name: 'Stockout', value: kpis.stockout_prob || 0, target: 15 },
            { name: 'Planogram', value: kpis.planogram_compliance || 0, target: 90 },
        ];
    }, [analyses]);

    // ---- CSV Export (Client-side from loaded data) ----
    const handleExportCSV = () => {
        if (analyses.length === 0) {
            alert('No data to export. Upload and analyze some shelf images first.');
            return;
        }

        const headers = [
            'Analysis ID', 'Date', 'Store', 'Detection Mode',
            'Products', 'Empty Slots', 'Misplaced',
            'Shelf Occupancy (%)', 'Empty Severity (%)', 'Shelf Imbalance (%)',
            'Misplacement Rate (%)', 'Product Density', 'Sell-Through (%)',
            'Stockout Prob (%)', 'Revenue at Risk ($)', 'Planogram Compliance (%)',
            'Risk Level', 'Model Confidence (%)',
        ];

        const rows = analyses.map((a) => [
            a.analysis_id || '',
            a.created_at ? new Date(a.created_at).toLocaleString() : '',
            a.store_name || 'N/A',
            a.detection_mode || 'opencv',
            a.visual_signals?.product_count ?? '',
            a.visual_signals?.empty_slot_count ?? '',
            a.visual_signals?.misplaced_count ?? '',
            a.kpis?.shelf_occupancy ?? '',
            a.kpis?.empty_severity ?? '',
            a.kpis?.shelf_imbalance ?? '',
            a.kpis?.misplacement_rate ?? '',
            a.kpis?.product_density ?? '',
            a.kpis?.sell_through ?? '',
            a.kpis?.stockout_prob ?? '',
            a.kpis?.revenue_at_risk ?? '',
            a.kpis?.planogram_compliance ?? '',
            a.risk?.level || '',
            a.risk?.model_confidence ? (a.risk.model_confidence * 100).toFixed(1) : '',
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map((r) => r.map((cell) => `"${cell}"`).join(',')),
        ].join('\n');

        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `ShelfGuard_Analysis_Report_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    // ---- PDF Export (using jsPDF + autoTable) ----
    const handleExportPDF = async () => {
        if (analyses.length === 0) {
            alert('No data to export. Upload and analyze some shelf images first.');
            return;
        }

        try {
            const doc = new jsPDF('landscape', 'mm', 'a4');
            const pageWidth = doc.internal.pageSize.getWidth();

            // ---- Title Section ----
            doc.setFillColor(15, 23, 42);
            doc.rect(0, 0, pageWidth, 35, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(20);
            doc.setFont('helvetica', 'bold');
            doc.text('ShelfGuard AI — Analysis Report', 14, 16);
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 24);
            doc.text(`Total Records: ${analyses.length} | Filter: ${riskFilter || 'All Risk Levels'}`, 14, 30);

            // ---- Summary Statistics ----
            doc.setTextColor(30, 41, 59);
            doc.setFontSize(13);
            doc.setFont('helvetica', 'bold');
            doc.text('Summary Statistics', 14, 45);

            const riskCounts = { Low: 0, Medium: 0, High: 0 };
            let totalOccupancy = 0, totalCompliance = 0, totalRevAtRisk = 0;
            analyses.forEach((a) => {
                const rl = a.risk?.level || 'Low';
                riskCounts[rl] = (riskCounts[rl] || 0) + 1;
                totalOccupancy += a.kpis?.shelf_occupancy || 0;
                totalCompliance += a.kpis?.planogram_compliance || 0;
                totalRevAtRisk += a.kpis?.revenue_at_risk || 0;
            });
            const n = analyses.length;

            const summaryData = [
                ['Total Analyses', `${n}`],
                ['Risk: Low / Medium / High', `${riskCounts.Low} / ${riskCounts.Medium} / ${riskCounts.High}`],
                ['Avg Shelf Occupancy', `${(totalOccupancy / n).toFixed(1)}%`],
                ['Avg Planogram Compliance', `${(totalCompliance / n).toFixed(1)}%`],
                ['Total Revenue at Risk', `$${totalRevAtRisk.toFixed(2)}`],
            ];

            doc.autoTable({
                startY: 50,
                head: [['Metric', 'Value']],
                body: summaryData,
                theme: 'grid',
                headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold' },
                styles: { fontSize: 9, cellPadding: 3 },
                columnStyles: { 0: { fontStyle: 'bold', cellWidth: 80 } },
                margin: { left: 14, right: 14 },
            });

            // ---- Detailed Analysis Table ----
            const detailY = doc.lastAutoTable.finalY + 12;
            doc.setFontSize(13);
            doc.setFont('helvetica', 'bold');
            doc.text('Detailed Analysis History', 14, detailY);

            const tableHeaders = [
                'ID', 'Date', 'Store', 'Mode', 'Products', 'Empty',
                'Occupancy', 'Compliance', 'Sell-Thru', 'Stockout',
                'Rev at Risk', 'Risk', 'Confidence',
            ];

            const tableRows = analyses.map((a) => [
                a.analysis_id || '',
                a.created_at ? new Date(a.created_at).toLocaleDateString() : '',
                a.store_name || 'N/A',
                (a.detection_mode || 'opencv').toUpperCase(),
                a.visual_signals?.product_count ?? '',
                a.visual_signals?.empty_slot_count ?? '',
                `${a.kpis?.shelf_occupancy ?? 0}%`,
                `${a.kpis?.planogram_compliance ?? 0}%`,
                `${a.kpis?.sell_through ?? 0}%`,
                `${a.kpis?.stockout_prob ?? 0}%`,
                `$${a.kpis?.revenue_at_risk ?? 0}`,
                a.risk?.level || '',
                a.risk?.model_confidence ? `${(a.risk.model_confidence * 100).toFixed(1)}%` : '',
            ]);

            doc.autoTable({
                startY: detailY + 5,
                head: [tableHeaders],
                body: tableRows,
                theme: 'striped',
                headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold', fontSize: 7 },
                styles: { fontSize: 7, cellPadding: 2 },
                alternateRowStyles: { fillColor: [241, 245, 249] },
                margin: { left: 14, right: 14 },
                didParseCell: (data) => {
                    // Color-code risk column
                    if (data.column.index === 11 && data.section === 'body') {
                        const val = data.cell.raw;
                        if (val === 'High') {
                            data.cell.styles.textColor = [220, 38, 38];
                            data.cell.styles.fontStyle = 'bold';
                        } else if (val === 'Medium') {
                            data.cell.styles.textColor = [217, 119, 6];
                            data.cell.styles.fontStyle = 'bold';
                        } else if (val === 'Low') {
                            data.cell.styles.textColor = [22, 163, 74];
                            data.cell.styles.fontStyle = 'bold';
                        }
                    }
                },
            });

            // ---- Feature Importance (from latest analysis) ----
            if (analyses[0]?.feature_importance?.length > 0) {
                const fiY = doc.lastAutoTable.finalY + 12;

                // Check if we need a new page
                if (fiY > doc.internal.pageSize.getHeight() - 40) {
                    doc.addPage();
                    doc.setFontSize(13);
                    doc.setFont('helvetica', 'bold');
                    doc.text('Feature Importance (Latest Analysis)', 14, 20);
                } else {
                    doc.setFontSize(13);
                    doc.setFont('helvetica', 'bold');
                    doc.text('Feature Importance (Latest Analysis)', 14, fiY);
                }

                const fiData = analyses[0].feature_importance.map((f) => [
                    f.feature,
                    `${(f.importance * 100).toFixed(1)}%`,
                ]);

                doc.autoTable({
                    startY: (fiY > doc.internal.pageSize.getHeight() - 40) ? 25 : fiY + 5,
                    head: [['Feature', 'Importance']],
                    body: fiData,
                    theme: 'grid',
                    headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold' },
                    styles: { fontSize: 9 },
                    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 80 } },
                    margin: { left: 14, right: 14 },
                });
            }

            // ---- Footer on all pages ----
            const pageCount = doc.internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(7);
                doc.setTextColor(148, 163, 184);
                doc.text(
                    `ShelfGuard AI — Retail Shelf Monitoring & KPI Risk Analysis | Page ${i} of ${pageCount}`,
                    pageWidth / 2, doc.internal.pageSize.getHeight() - 5,
                    { align: 'center' }
                );
            }

            doc.save(`ShelfGuard_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
        } catch (err) {
            console.error('PDF export error:', err);
            alert('PDF export failed. Please try again.');
        }
    };

    const totalPages = Math.max(1, Math.ceil(total / perPage));
    const riskColor = (level) => {
        if (level === 'Low') return '#34d399';
        if (level === 'Medium') return '#fbbf24';
        return '#f87171';
    };

    return (
        <div className="history-page">
            <div className="history-header">
                <div className="history-title">
                    <Clock size={22} />
                    <h2>History & Trends</h2>
                    <span className="record-count">{total} records</span>
                </div>

                <div className="history-actions">
                    <button className="export-btn" onClick={handleExportCSV}>
                        <Download size={14} /> CSV
                    </button>
                    <button className="export-btn" onClick={handleExportPDF}>
                        <FileText size={14} /> PDF
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="history-filters glass-card">
                <Filter size={16} />
                <select value={riskFilter} onChange={(e) => { setRiskFilter(e.target.value); setPage(1); }}>
                    <option value="">All Risk Levels</option>
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                </select>
                <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(1); }} />
                <span className="filter-sep">to</span>
                <input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(1); }} />
                <button className="clear-filters" onClick={() => { setRiskFilter(''); setStartDate(''); setEndDate(''); setPage(1); }}>
                    Clear
                </button>
            </div>

            {/* Charts */}
            {trendData.length > 1 && (
                <div className="history-charts">
                    <div className="glass-card chart-card">
                        <h3><TrendingUp size={16} /> Risk Trend</h3>
                        <ResponsiveContainer width="100%" height={250}>
                            <LineChart data={trendData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
                                <YAxis stroke="#64748b" fontSize={11} domain={[0, 2]}
                                    tickFormatter={(v) => ['Low', 'Med', 'High'][v] || v} />
                                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                                    labelStyle={{ color: '#94a3b8' }} />
                                <Line type="monotone" dataKey="risk" stroke="#f87171" strokeWidth={2} dot={{ r: 3 }} name="Risk Level" />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="glass-card chart-card">
                        <h3><TrendingUp size={16} /> KPI Comparison (Latest)</h3>
                        <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={kpiCompareData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                <XAxis dataKey="name" stroke="#64748b" fontSize={10} />
                                <YAxis stroke="#64748b" fontSize={11} />
                                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
                                    labelStyle={{ color: '#94a3b8' }} />
                                <Legend />
                                <Bar dataKey="value" fill="#818cf8" name="Actual" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="target" fill="rgba(255,255,255,0.1)" name="Target" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* Table */}
            <div className="glass-card history-table-wrap">
                {loading ? (
                    <div className="history-loading">Loading analyses...</div>
                ) : analyses.length === 0 ? (
                    <div className="history-empty">
                        <Search size={40} />
                        <p>No analyses found. Upload a shelf image to get started.</p>
                    </div>
                ) : (
                    <>
                        <div className="table-scroll">
                            <table className="history-table">
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>Date</th>
                                        <th>Store</th>
                                        <th>Mode</th>
                                        <th>Products</th>
                                        <th>Empty</th>
                                        <th>Occupancy</th>
                                        <th>Planogram</th>
                                        <th>Risk</th>
                                        <th>Confidence</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {analyses.map((a) => (
                                        <tr key={a.analysis_id}>
                                            <td className="mono">{a.analysis_id}</td>
                                            <td>{a.created_at ? new Date(a.created_at).toLocaleString() : '—'}</td>
                                            <td>{a.store_name || '—'}</td>
                                            <td><span className={`mode-badge ${a.detection_mode}`}>{a.detection_mode}</span></td>
                                            <td>{a.visual_signals?.product_count ?? '—'}</td>
                                            <td>{a.visual_signals?.empty_slot_count ?? '—'}</td>
                                            <td>{a.kpis?.shelf_occupancy ?? '—'}%</td>
                                            <td>{a.kpis?.planogram_compliance ?? '—'}%</td>
                                            <td>
                                                <span className="risk-badge" style={{ color: riskColor(a.risk?.level), borderColor: riskColor(a.risk?.level) }}>
                                                    {a.risk?.level || '—'}
                                                </span>
                                            </td>
                                            <td>{a.risk?.model_confidence ? `${(a.risk.model_confidence * 100).toFixed(1)}%` : '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        <div className="pagination">
                            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                                <ChevronLeft size={16} />
                            </button>
                            <span>Page {page} of {totalPages}</span>
                            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
