import {
  BarChart3, TrendingUp, AlertTriangle, Shield,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import './KPIDashboard.css';

export default function KPIDashboard({ result }) {
  const { risk, comparison, yolo, depth } = result;
  const { shelf_condition } = comparison;
  const yoloM = yolo.kpi_metrics;
  const depthM = depth.kpi_metrics;

  // Feature importance data
  const fiData = risk.feature_importance.slice(0, 8).map(f => ({
    name: f.feature.length > 15 ? f.feature.slice(0, 14) + '…' : f.feature,
    importance: Math.round(f.importance * 100),
    value: f.value,
  }));

  // Risk probability pie
  const riskPieData = Object.entries(risk.probabilities).map(([label, prob]) => ({
    name: label,
    value: Math.round(prob * 100),
  }));
  const RISK_COLORS = ['#22c55e', '#3b82f6', '#eab308', '#f97316', '#ef4444', '#dc2626'];

  // Shelf condition components
  const condComps = shelf_condition.components;

  return (
    <div className="kd-container">
      {/* ---- KPI Cards ---- */}
      <div className="kd-cards-grid">
        <KPICard label="Surface Occupancy" value={`${(yoloM.occupancy_ratio * 100).toFixed(0)}%`} icon={<BarChart3 size={18} />} color="#818cf8" sub="YOLOv8 detection" />
        <KPICard label="Depth Occupancy" value={`${(depthM.depth_occupancy_score * 100).toFixed(0)}%`} icon={<Shield size={18} />} color="#22d3ee" sub="Depth Anything V2" />
        <KPICard label="Product Count" value={yoloM.product_count || yolo.summary.product_count} icon={<TrendingUp size={18} />} color="#34d399" sub={`${yoloM.shelf_density} per shelf`} />
        <KPICard label="Hollow Score" value={`${(depthM.hollow_shelf_score * 100).toFixed(0)}%`} icon={<AlertTriangle size={18} />} color="#fbbf24" sub="False fullness risk" />
        <KPICard label="Rear Empty" value={`${(depthM.rear_empty_ratio * 100).toFixed(0)}%`} icon={<AlertTriangle size={18} />} color="#f97316" sub="Behind visible products" />
        <KPICard label="Shelf Balance" value={`${(yoloM.shelf_balance_score * 100).toFixed(0)}%`} icon={<BarChart3 size={18} />} color="#a78bfa" sub="Distribution evenness" />
        <KPICard label="Coverage" value={`${yoloM.coverage_percentage}%`} icon={<BarChart3 size={18} />} color="#38bdf8" sub="Product area coverage" />
        <KPICard label="False Fullness" value={`${(depthM.false_fullness_risk * 100).toFixed(0)}%`} icon={<AlertTriangle size={18} />} color="#fb7185" sub="Depth model risk" />
      </div>

      {/* ---- Shelf Condition Breakdown ---- */}
      <div className="kd-condition glass-card">
        <h3>Shelf Condition Breakdown</h3>
        <div className="kd-cond-grid">
          <CondBar label="Surface Occupancy" value={condComps.surface_occupancy} color="#818cf8" />
          <CondBar label="Depth Occupancy" value={condComps.depth_occupancy} color="#22d3ee" />
          <CondBar label="Balance" value={condComps.balance} color="#34d399" />
          <CondBar label="Hollow Penalty" value={condComps.hollow_penalty} color="#ef4444" invert />
          <CondBar label="Rear Empty Penalty" value={condComps.rear_empty_penalty} color="#f97316" invert />
          <CondBar label="False Fullness Penalty" value={condComps.false_fullness_penalty} color="#eab308" invert />
        </div>
      </div>

      {/* ---- Charts ---- */}
      <div className="kd-charts">
        <div className="kd-chart glass-card">
          <h3>Feature Importance (Risk Model)</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={fiData} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={120} tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0' }}
                formatter={(val) => [`${val}%`, 'Importance']} />
              <Bar dataKey="importance" fill="#818cf8" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="kd-chart glass-card">
          <h3>Risk Probability Distribution</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={riskPieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100}
                paddingAngle={2} dataKey="value" label={({ name, value }) => `${name}: ${value}%`}>
                {riskPieData.map((_, i) => (
                  <Cell key={i} fill={RISK_COLORS[i % RISK_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(val) => [`${val}%`, 'Probability']} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ---- Model Info ---- */}
      <div className="kd-model-info glass-card">
        <h3>Model Information</h3>
        <div className="kd-info-grid">
          <div><strong>Risk Algorithm:</strong> {risk.model_info.algorithm}</div>
          <div><strong>Estimators:</strong> {risk.model_info.n_estimators}</div>
          <div><strong>Features:</strong> {risk.model_info.n_features}</div>
          <div><strong>Risk Classes:</strong> {risk.model_info.n_classes}</div>
          <div><strong>YOLOv8:</strong> {yolo.model_name}</div>
          <div><strong>Depth:</strong> {depth.model_name}</div>
        </div>
      </div>
    </div>
  );
}

function KPICard({ label, value, icon, color, sub }) {
  return (
    <div className="kd-card glass-card">
      <div className="kd-card-icon" style={{ color }}>{icon}</div>
      <div className="kd-card-value" style={{ color }}>{value}</div>
      <div className="kd-card-label">{label}</div>
      {sub && <div className="kd-card-sub">{sub}</div>}
    </div>
  );
}

function CondBar({ label, value, color, invert }) {
  return (
    <div className="kd-cond-item">
      <div className="kd-cond-label">
        <span>{label}</span>
        <span style={{ color: invert && value > 30 ? '#ef4444' : color }}>{value}%</span>
      </div>
      <div className="kd-cond-track">
        <div className="kd-cond-fill" style={{ width: `${Math.min(100, value)}%`, background: invert && value > 30 ? '#ef4444' : color }} />
      </div>
    </div>
  );
}
