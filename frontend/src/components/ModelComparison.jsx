import { useState } from 'react';
import {
  Eye, Layers, BarChart3, AlertTriangle, CheckCircle, Info,
  ChevronDown, ChevronUp, ArrowLeftRight,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, Radar, Legend,
} from 'recharts';
import './ModelComparison.css';

export default function ModelComparison({ result }) {
  const [expandedImage, setExpandedImage] = useState(null);

  const { yolo, depth, comparison, risk } = result;
  const { kpi_table, occupancy_comparison, consistency_score, disagreements, shelf_condition, conclusion } = comparison;

  // Build chart data for bar comparison
  const barData = kpi_table
    .filter(k => k.source === 'both')
    .map(k => ({
      name: k.kpi,
      YOLOv8: k.yolo_value,
      'Depth V2': k.depth_value,
    }));

  // Build radar data
  const radarData = [
    { metric: 'Surface Occ.', yolo: yolo.kpi_metrics.occupancy_ratio * 100, depth: depth.kpi_metrics.depth_occupancy_score * 100 },
    { metric: 'Balance', yolo: yolo.kpi_metrics.shelf_balance_score * 100, depth: depth.kpi_metrics.depth_uniformity * 100 },
    { metric: 'Coverage', yolo: yolo.kpi_metrics.coverage_percentage, depth: (1 - depth.kpi_metrics.rear_empty_ratio) * 100 },
    { metric: 'Density', yolo: Math.min(100, yolo.kpi_metrics.shelf_density * 10), depth: (1 - depth.kpi_metrics.hollow_shelf_score) * 100 },
    { metric: 'Spread', yolo: yolo.kpi_metrics.spread_score * 100, depth: depth.kpi_metrics.depth_uniformity * 100 },
  ];

  const riskColor = risk.risk_color;
  const condGrade = shelf_condition.grade;
  const gradeColors = { A: '#22c55e', B: '#3b82f6', C: '#eab308', D: '#f97316', F: '#ef4444' };

  return (
    <div className="mc-container">
      {/* ---- Risk Banner ---- */}
      <div className="mc-risk-banner glass-card" style={{ borderLeftColor: riskColor }}>
        <div className="mc-risk-left">
          <span className="mc-risk-icon">{risk.risk_icon}</span>
          <div>
            <h2 style={{ color: riskColor }}>{risk.risk_label}</h2>
            <span className="mc-risk-conf">Confidence: {(risk.confidence * 100).toFixed(0)}%</span>
          </div>
        </div>
        <div className="mc-risk-right">
          <div className="mc-condition-badge" style={{ background: gradeColors[condGrade] + '22', color: gradeColors[condGrade] }}>
            <span className="mc-grade">{condGrade}</span>
            <span className="mc-score">{shelf_condition.score}/100</span>
          </div>
        </div>
      </div>

      {/* ---- AI Conclusion Panel ---- */}
      <div className={`mc-conclusion glass-card mc-sev-${conclusion.severity}`}>
        <h3><Info size={16} /> AI Conclusion</h3>
        <pre className="mc-conclusion-text">{conclusion.text}</pre>
      </div>

      {/* ---- Side-by-Side Visual Comparison ---- */}
      <div className="mc-visuals">
        <div className="mc-visual-card glass-card" onClick={() => setExpandedImage(expandedImage === 'yolo' ? null : 'yolo')}>
          <div className="mc-visual-header">
            <Eye size={16} />
            <h3>YOLOv8 Detection</h3>
            <span className="mc-model-badge">{yolo.model_name}</span>
          </div>
          <img
            src={`data:image/jpeg;base64,${yolo.annotated_image}`}
            alt="YOLOv8 Detection"
            className={`mc-img ${expandedImage === 'yolo' ? 'expanded' : ''}`}
          />
          <div className="mc-visual-stats">
            <span>{yolo.summary.product_count} products</span>
            <span>{yolo.summary.empty_slot_count} empty slots</span>
            <span>{(yolo.kpi_metrics.occupancy_ratio * 100).toFixed(0)}% occupancy</span>
          </div>
        </div>

        <div className="mc-visual-card glass-card" onClick={() => setExpandedImage(expandedImage === 'depth' ? null : 'depth')}>
          <div className="mc-visual-header">
            <Layers size={16} />
            <h3>Depth Anything V2</h3>
            <span className="mc-model-badge">{depth.model_name}</span>
          </div>
          <img
            src={`data:image/jpeg;base64,${depth.depth_heatmap}`}
            alt="Depth Heatmap"
            className={`mc-img ${expandedImage === 'depth' ? 'expanded' : ''}`}
          />
          <div className="mc-visual-stats">
            <span>{depth.summary.hollow_region_count} hollow regions</span>
            <span>Avg depth: {depth.summary.avg_depth}</span>
            <span>{(depth.kpi_metrics.depth_occupancy_score * 100).toFixed(0)}% depth occ.</span>
          </div>
        </div>
      </div>

      {/* ---- Additional Visuals: Occupancy Mask + Hollow Overlay ---- */}
      <div className="mc-visuals">
        <div className="mc-visual-card glass-card mc-small">
          <h4>Occupancy Mask</h4>
          <img src={`data:image/jpeg;base64,${yolo.occupancy_mask}`} alt="Occupancy Mask" className="mc-img-small" />
        </div>
        <div className="mc-visual-card glass-card mc-small">
          <h4>Hollow Shelf Overlay</h4>
          <img src={`data:image/jpeg;base64,${depth.hollow_overlay}`} alt="Hollow Overlay" className="mc-img-small" />
        </div>
      </div>

      {/* ---- Occupancy Comparison Highlight ---- */}
      <div className={`mc-occ-compare glass-card mc-occ-${occupancy_comparison.status}`}>
        <h3><ArrowLeftRight size={16} /> Occupancy Comparison</h3>
        <div className="mc-occ-bars">
          <div className="mc-occ-item">
            <span className="mc-occ-label">YOLOv8 (Surface)</span>
            <div className="mc-occ-bar-track">
              <div className="mc-occ-bar yolo" style={{ width: `${occupancy_comparison.yolo_occupancy}%` }}>
                {occupancy_comparison.yolo_occupancy}%
              </div>
            </div>
          </div>
          <div className="mc-occ-item">
            <span className="mc-occ-label">Depth V2 (Real)</span>
            <div className="mc-occ-bar-track">
              <div className="mc-occ-bar depth" style={{ width: `${occupancy_comparison.depth_occupancy}%` }}>
                {occupancy_comparison.depth_occupancy}%
              </div>
            </div>
          </div>
        </div>
        <div className="mc-occ-diff">
          Difference: <strong>{occupancy_comparison.abs_difference}%</strong>
        </div>
        <p className="mc-occ-interp">{occupancy_comparison.interpretation}</p>
      </div>

      {/* ---- KPI Comparison Table ---- */}
      <div className="mc-kpi-table glass-card">
        <h3><BarChart3 size={16} /> KPI Comparison Table</h3>
        <div className="mc-table-wrap">
          <table>
            <thead>
              <tr>
                <th>KPI</th>
                <th>YOLOv8</th>
                <th>Depth V2</th>
                <th>Diff</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {kpi_table.map((k, i) => (
                <tr key={i} className={k.alert ? 'mc-row-alert' : ''}>
                  <td>
                    <strong>{k.kpi}</strong>
                    <small>{k.description}</small>
                  </td>
                  <td>{k.yolo_value != null ? `${k.yolo_value}${k.unit}` : '—'}</td>
                  <td>{k.depth_value != null ? `${k.depth_value}${k.unit}` : '—'}</td>
                  <td className={k.difference > 15 ? 'mc-diff-high' : k.difference > 5 ? 'mc-diff-med' : ''}>
                    {k.difference != null ? `${k.difference}${k.unit}` : '—'}
                  </td>
                  <td><span className={`mc-source mc-src-${k.source}`}>{k.source}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---- Charts ---- */}
      <div className="mc-charts">
        <div className="mc-chart-card glass-card">
          <h3>KPI Bar Comparison</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={barData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0' }} />
              <Legend />
              <Bar dataKey="YOLOv8" fill="#818cf8" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Depth V2" fill="#22d3ee" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="mc-chart-card glass-card">
          <h3>Model Radar Overlay</h3>
          <ResponsiveContainer width="100%" height={280}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#1e293b" />
              <PolarAngleAxis dataKey="metric" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <PolarRadiusAxis tick={{ fill: '#64748b', fontSize: 10 }} domain={[0, 100]} />
              <Radar name="YOLOv8" dataKey="yolo" stroke="#818cf8" fill="#818cf8" fillOpacity={0.2} />
              <Radar name="Depth V2" dataKey="depth" stroke="#22d3ee" fill="#22d3ee" fillOpacity={0.2} />
              <Legend />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ---- Disagreements ---- */}
      {disagreements.length > 0 && (
        <div className="mc-disagreements glass-card">
          <h3><AlertTriangle size={16} /> Model Disagreements ({disagreements.length})</h3>
          {disagreements.map((d, i) => (
            <div key={i} className={`mc-disagree-item mc-sev-${d.severity}`}>
              <h4>{d.area}</h4>
              <div className="mc-disagree-grid">
                <div><strong>YOLOv8 says:</strong> {d.yolo_says}</div>
                <div><strong>Depth V2 says:</strong> {d.depth_says}</div>
              </div>
              <p className="mc-disagree-explain">{d.explanation}</p>
            </div>
          ))}
        </div>
      )}

      {/* ---- Consistency Score ---- */}
      <div className="mc-consistency glass-card">
        <h3>Model Consistency</h3>
        <div className="mc-consist-bar-wrap">
          <div className="mc-consist-bar" style={{ width: `${consistency_score.score}%` }}>
            {consistency_score.score}%
          </div>
        </div>
        <span className={`mc-consist-label mc-consist-${consistency_score.level}`}>
          {consistency_score.label}
        </span>
      </div>
    </div>
  );
}
