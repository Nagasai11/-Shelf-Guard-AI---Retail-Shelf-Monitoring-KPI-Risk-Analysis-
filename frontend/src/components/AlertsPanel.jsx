import { AlertTriangle, AlertCircle, CheckCircle, Info, ArrowRight } from 'lucide-react';
import './AlertsPanel.css';

export default function AlertsPanel({ result }) {
  const { risk, comparison, yolo, depth } = result;
  const { disagreements, occupancy_comparison, shelf_condition, conclusion } = comparison;
  const yoloM = yolo.kpi_metrics;
  const depthM = depth.kpi_metrics;

  // Generate alerts from comparison data
  const alerts = [];

  // Risk-level alert
  if (risk.risk_level >= 4) {
    alerts.push({ type: 'critical', title: `${risk.risk_icon} ${risk.risk_label} Detected`, desc: `Risk confidence: ${(risk.confidence * 100).toFixed(0)}%. Immediate intervention recommended.` });
  } else if (risk.risk_level >= 2) {
    alerts.push({ type: 'warning', title: `${risk.risk_icon} ${risk.risk_label}`, desc: `Risk confidence: ${(risk.confidence * 100).toFixed(0)}%. Monitor closely.` });
  } else {
    alerts.push({ type: 'info', title: `${risk.risk_icon} ${risk.risk_label}`, desc: `Shelf is in good condition. Confidence: ${(risk.confidence * 100).toFixed(0)}%.` });
  }

  // Occupancy gap alert
  if (occupancy_comparison.abs_difference > 15) {
    alerts.push({ type: 'critical', title: 'Major Occupancy Discrepancy', desc: occupancy_comparison.interpretation });
  } else if (occupancy_comparison.abs_difference > 5) {
    alerts.push({ type: 'warning', title: 'Occupancy Discrepancy', desc: occupancy_comparison.interpretation });
  }

  // False fullness
  if (depthM.false_fullness_risk > 0.4) {
    alerts.push({ type: 'critical', title: 'False Fullness Risk', desc: `Depth model detects ${(depthM.false_fullness_risk * 100).toFixed(0)}% false fullness risk. Products fronted but rear is depleted.` });
  } else if (depthM.false_fullness_risk > 0.2) {
    alerts.push({ type: 'warning', title: 'Moderate False Fullness', desc: `${(depthM.false_fullness_risk * 100).toFixed(0)}% false fullness risk detected.` });
  }

  // Hollow regions
  if (depthM.hollow_shelf_score > 0.3) {
    alerts.push({ type: 'warning', title: 'Hollow Shelf Regions', desc: `${(depthM.hollow_shelf_score * 100).toFixed(0)}% hollow score. Some areas have products only at the front edge.` });
  }

  // Low surface occupancy
  if (yoloM.occupancy_ratio < 0.6) {
    alerts.push({ type: 'critical', title: 'Low Shelf Occupancy', desc: `Only ${(yoloM.occupancy_ratio * 100).toFixed(0)}% surface occupancy detected. Restocking needed.` });
  } else if (yoloM.occupancy_ratio < 0.8) {
    alerts.push({ type: 'warning', title: 'Below Target Occupancy', desc: `${(yoloM.occupancy_ratio * 100).toFixed(0)}% occupancy (target: 85%).` });
  }

  // Model disagreements
  disagreements.forEach(d => {
    alerts.push({ type: d.severity === 'high' ? 'critical' : 'warning', title: `Model Disagreement: ${d.area}`, desc: d.explanation });
  });

  // Generate recommendations
  const recommendations = [];

  if (shelf_condition.score < 50) {
    recommendations.push({ priority: 'high', title: 'Immediate Restocking Required', desc: `Shelf condition score is ${shelf_condition.score}/100 (Grade ${shelf_condition.grade}). Prioritize restocking empty and hollow regions.`, action: 'Dispatch restocking team' });
  } else if (shelf_condition.score < 70) {
    recommendations.push({ priority: 'medium', title: 'Schedule Restocking', desc: `Shelf condition ${shelf_condition.score}/100. Plan restocking within the next shift.`, action: 'Add to restocking queue' });
  }

  if (depthM.rear_empty_ratio > 0.3) {
    recommendations.push({ priority: 'high', title: 'Rear Stock Depletion', desc: `${(depthM.rear_empty_ratio * 100).toFixed(0)}% rear empty space. Push products forward or restock from the back.`, action: 'Pull products forward, refill rear' });
  }

  if (yoloM.shelf_balance_score < 0.5) {
    recommendations.push({ priority: 'medium', title: 'Rebalance Shelf Products', desc: `Balance score is ${(yoloM.shelf_balance_score * 100).toFixed(0)}%. Products are unevenly distributed.`, action: 'Redistribute products across shelves' });
  }

  recommendations.push({ priority: 'low', title: 'Continuous Monitoring', desc: 'Schedule regular dual-model scans every 2-4 hours for optimal tracking.', action: 'Set automated scanning' });

  const alertIcon = { critical: <AlertTriangle size={16} />, warning: <AlertCircle size={16} />, info: <CheckCircle size={16} /> };
  const priIcon = { high: '🔴', medium: '🟡', low: '🟢' };

  return (
    <div className="ap-container">
      {/* Alerts */}
      <div className="ap-section glass-card">
        <h3>System Alerts ({alerts.length})</h3>
        <div className="ap-list">
          {alerts.map((a, i) => (
            <div key={i} className={`ap-alert ap-${a.type}`}>
              <div className="ap-alert-icon">{alertIcon[a.type]}</div>
              <div>
                <h4>{a.title}</h4>
                <p>{a.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recommendations */}
      <div className="ap-section glass-card">
        <h3>Recommendations ({recommendations.length})</h3>
        <div className="ap-list">
          {recommendations.map((r, i) => (
            <div key={i} className={`ap-rec ap-pri-${r.priority}`}>
              <span className="ap-pri-icon">{priIcon[r.priority]}</span>
              <div>
                <h4>{r.title}</h4>
                <p>{r.desc}</p>
                <div className="ap-action"><ArrowRight size={12} /> {r.action}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
