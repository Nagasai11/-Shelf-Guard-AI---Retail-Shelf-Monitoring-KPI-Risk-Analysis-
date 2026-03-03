"""
KPI Engine - Predictive Analytics & Risk Analysis
Computes retail KPIs from fused visual + sales signals
and predicts risk using Random Forest classification.
"""

import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
import random


class KPIEngine:
    """
    Calculates retail KPIs and predicts risk levels using
    machine learning (Random Forest Classifier).
    """

    def __init__(self):
        self.risk_model = None
        self.scaler = StandardScaler()
        self._train_risk_model()

    def _train_risk_model(self):
        """
        Train a Random Forest classifier on synthetic training data.
        Features: occupancy, empty_count, density_std, sell_through, stockout_risk
        Target: risk_level (0=low, 1=medium, 2=high)
        """
        np.random.seed(42)
        n_samples = 1000

        # Generate synthetic training data
        occupancy = np.random.uniform(0.2, 1.0, n_samples)
        empty_count = np.random.randint(0, 15, n_samples)
        density_std = np.random.uniform(0, 5, n_samples)
        sell_through = np.random.uniform(0.1, 1.0, n_samples)
        stockout_risk = np.random.uniform(0, 1.0, n_samples)
        shelf_balance = np.random.uniform(0, 1.0, n_samples)
        misplaced_ratio = np.random.uniform(0, 0.5, n_samples)

        X = np.column_stack([
            occupancy, empty_count, density_std,
            sell_through, stockout_risk, shelf_balance, misplaced_ratio
        ])

        # Define risk labels based on rules
        risk_score = (
            (1 - occupancy) * 0.25 +
            (empty_count / 15) * 0.20 +
            (density_std / 5) * 0.10 +
            (1 - sell_through) * 0.15 +
            stockout_risk * 0.15 +
            (1 - shelf_balance) * 0.10 +
            misplaced_ratio * 0.05
        )

        y = np.zeros(n_samples, dtype=int)
        y[risk_score > 0.35] = 1  # Medium risk
        y[risk_score > 0.55] = 2  # High risk

        # Train model
        self.scaler.fit(X)
        X_scaled = self.scaler.transform(X)

        self.risk_model = RandomForestClassifier(
            n_estimators=100,
            max_depth=10,
            random_state=42,
            class_weight='balanced'
        )
        self.risk_model.fit(X_scaled, y)

    def compute_kpis(self, visual_signals, sales_data):
        """
        Compute comprehensive KPIs by fusing visual and sales signals.
        """
        # Core KPIs
        shelf_occupancy = visual_signals.get("shelf_occupancy", 0.5)
        product_count = visual_signals.get("product_count", 0)
        empty_slots = visual_signals.get("empty_slot_count", 0)
        misplaced = visual_signals.get("misplaced_count", 0)
        density_std = visual_signals.get("shelf_density_std", 0)
        shelf_balance = visual_signals.get("shelf_balance_index", 0.5)
        total_shelves = visual_signals.get("total_shelves", 1)

        # Sales-derived metrics
        store_summary = sales_data.get("store_summary", {})
        category_metrics = sales_data.get("category_metrics", {})

        avg_sell_through = np.mean([
            m.get("sell_through_rate", 0.5)
            for m in category_metrics.values()
        ]) if category_metrics else 0.5

        avg_stockout_risk = np.mean([
            m.get("stockout_risk", 0.2)
            for m in category_metrics.values()
        ]) if category_metrics else 0.2

        # Compute derived KPIs
        empty_severity = visual_signals.get("empty_severity_score", 0)
        max_severity = total_shelves * 3  # Max possible severity
        normalized_severity = min(1.0, empty_severity / max(max_severity, 1))

        products_per_shelf = product_count / max(total_shelves, 1)
        misplaced_ratio = misplaced / max(product_count, 1)

        # Revenue impact estimation
        weekly_revenue = store_summary.get("total_weekly_revenue", 10000)
        revenue_at_risk = round(weekly_revenue * (1 - shelf_occupancy) * 0.6, 2)

        kpis = {
            "shelf_occupancy": {
                "value": round(shelf_occupancy * 100, 1),
                "unit": "%",
                "status": self._get_status(shelf_occupancy, [0.8, 0.6]),
                "target": 85,
                "description": "Percentage of shelf space occupied by products",
            },
            "empty_slot_severity": {
                "value": round(normalized_severity * 100, 1),
                "unit": "%",
                "status": self._get_status(1 - normalized_severity, [0.7, 0.4]),
                "target": 10,
                "description": "Severity index of empty shelf positions",
            },
            "shelf_imbalance": {
                "value": round((1 - shelf_balance) * 100, 1),
                "unit": "%",
                "status": self._get_status(shelf_balance, [0.7, 0.4]),
                "target": 15,
                "description": "Product distribution imbalance across shelves",
            },
            "misplacement_rate": {
                "value": round(misplaced_ratio * 100, 1),
                "unit": "%",
                "status": self._get_status(1 - misplaced_ratio, [0.9, 0.8]),
                "target": 5,
                "description": "Percentage of products in wrong shelf positions",
            },
            "product_density": {
                "value": round(products_per_shelf, 1),
                "unit": "items/shelf",
                "status": self._get_status(
                    min(1, products_per_shelf / 10), [0.6, 0.3]
                ),
                "target": 8,
                "description": "Average number of products per shelf",
            },
            "sell_through_rate": {
                "value": round(avg_sell_through * 100, 1),
                "unit": "%",
                "status": self._get_status(avg_sell_through, [0.7, 0.4]),
                "target": 75,
                "description": "Ratio of sold units to available stock",
            },
            "stockout_probability": {
                "value": round(avg_stockout_risk * 100, 1),
                "unit": "%",
                "status": self._get_status(1 - avg_stockout_risk, [0.75, 0.5]),
                "target": 15,
                "description": "Probability of category stockout in next period",
            },
            "revenue_at_risk": {
                "value": round(revenue_at_risk, 2),
                "unit": "$",
                "status": "critical" if revenue_at_risk > weekly_revenue * 0.15
                else "warning" if revenue_at_risk > weekly_revenue * 0.08
                else "healthy",
                "target": 0,
                "description": "Estimated weekly revenue at risk due to shelf gaps",
            },
            "planogram_compliance": self._compute_planogram_compliance(
                visual_signals, shelf_occupancy, misplaced_ratio, shelf_balance
            ),
        }


        # Predict overall risk
        risk_prediction = self._predict_risk(
            shelf_occupancy, empty_slots, density_std,
            avg_sell_through, avg_stockout_risk, shelf_balance, misplaced_ratio
        )

        # Generate recommendations
        recommendations = self._generate_recommendations(kpis, visual_signals, sales_data)

        # Generate alerts
        alerts = self._generate_alerts(kpis, visual_signals)

        return {
            "kpis": kpis,
            "risk_prediction": risk_prediction,
            "recommendations": recommendations,
            "alerts": alerts,
            "revenue_impact": {
                "weekly_revenue": weekly_revenue,
                "revenue_at_risk": revenue_at_risk,
                "potential_recovery": round(revenue_at_risk * 0.7, 2),
            },
        }

    def _predict_risk(self, occupancy, empty_count, density_std,
                      sell_through, stockout_risk, shelf_balance, misplaced_ratio):
        """Predict risk level using trained Random Forest model."""
        features = np.array([[
            occupancy, empty_count, density_std,
            sell_through, stockout_risk, shelf_balance, misplaced_ratio
        ]])

        features_scaled = self.scaler.transform(features)

        prediction = self.risk_model.predict(features_scaled)[0]
        probabilities = self.risk_model.predict_proba(features_scaled)[0]

        # Feature importance
        importance = self.risk_model.feature_importances_
        feature_names = [
            "Shelf Occupancy", "Empty Slots", "Density Variance",
            "Sell-Through Rate", "Stockout Risk", "Shelf Balance", "Misplacement Ratio"
        ]

        risk_labels = ["Low", "Medium", "High"]

        return {
            "overall_risk": risk_labels[prediction],
            "risk_level": int(prediction),
            "probabilities": {
                "low": round(float(probabilities[0]), 3),
                "medium": round(float(probabilities[1]), 3),
                "high": round(float(probabilities[2]), 3),
            },
            "feature_importance": [
                {"feature": name, "importance": round(float(imp), 4)}
                for name, imp in sorted(
                    zip(feature_names, importance),
                    key=lambda x: x[1], reverse=True
                )
            ],
            "model_info": {
                "algorithm": "Random Forest Classifier",
                "n_estimators": 100,
                "confidence": round(float(max(probabilities)), 3),
            },
        }

    def _compute_planogram_compliance(self, visual_signals, occupancy, misplaced_ratio, shelf_balance):
        """
        Compute Planogram Compliance Score (0-100%).
        Compares actual product distribution across shelf levels against ideal distribution.
        """
        category_dist = visual_signals.get("category_distribution", {})
        total_shelves = visual_signals.get("total_shelves", 1)

        # Component scores
        balance_score = shelf_balance  # Higher = more balanced = more compliant
        placement_score = 1.0 - misplaced_ratio  # Lower misplacement = better
        occupancy_score = min(1.0, occupancy / 0.85)  # Relative to 85% target

        # Category distribution uniformity
        if category_dist:
            counts = list(category_dist.values())
            if len(counts) > 1:
                ideal_per_cat = sum(counts) / len(counts)
                deviation = sum(abs(c - ideal_per_cat) for c in counts) / (sum(counts) + 1)
                distribution_score = max(0, 1.0 - deviation)
            else:
                distribution_score = 0.7
        else:
            distribution_score = 0.5

        # Weighted compliance
        compliance = (
            balance_score * 0.30 +
            placement_score * 0.25 +
            occupancy_score * 0.25 +
            distribution_score * 0.20
        )
        compliance_pct = round(min(100, max(0, compliance * 100)), 1)

        return {
            "value": compliance_pct,
            "unit": "%",
            "status": self._get_status(compliance, [0.8, 0.6]),
            "target": 90,
            "description": "Planogram compliance score based on product distribution",
        }

    def _get_status(self, value, thresholds):
        """Determine status based on value and thresholds [healthy, warning]."""
        if value >= thresholds[0]:
            return "healthy"
        elif value >= thresholds[1]:
            return "warning"
        else:
            return "critical"

    def _generate_recommendations(self, kpis, visual_signals, sales_data):
        """Generate actionable recommendations based on KPIs."""
        recs = []

        occupancy = kpis["shelf_occupancy"]["value"]
        if occupancy < 70:
            recs.append({
                "priority": "high",
                "category": "Restocking",
                "title": "Immediate Restocking Required",
                "description": f"Shelf occupancy is at {occupancy}%, well below the 85% target. "
                               "Schedule immediate restocking for affected shelves.",
                "impact": "High - Potential revenue loss from empty shelf space",
                "action": "Notify warehouse team for priority restocking",
            })
        elif occupancy < 85:
            recs.append({
                "priority": "medium",
                "category": "Restocking",
                "title": "Schedule Restocking",
                "description": f"Shelf occupancy at {occupancy}% is approaching the warning threshold. "
                               "Plan restocking within the next shift.",
                "impact": "Medium - Gradual revenue decline if unaddressed",
                "action": "Add to next restocking cycle",
            })

        empty_severity = kpis["empty_slot_severity"]["value"]
        if empty_severity > 40:
            recs.append({
                "priority": "high",
                "category": "Shelf Management",
                "title": "Critical Empty Shelf Gaps Detected",
                "description": f"Empty slot severity is {empty_severity}%. "
                               "Multiple high-severity gaps require immediate attention.",
                "impact": "High - Customer experience and sales impact",
                "action": "Redistribute products and fill gaps immediately",
            })

        misplacement = kpis["misplacement_rate"]["value"]
        if misplacement > 10:
            recs.append({
                "priority": "medium",
                "category": "Planogram Compliance",
                "title": "Product Misplacement Detected",
                "description": f"{misplacement}% of products appear to be misplaced. "
                               "Review planogram compliance.",
                "impact": "Medium - Affects customer navigation and sales mix",
                "action": "Conduct planogram audit and rearrange products",
            })

        imbalance = kpis["shelf_imbalance"]["value"]
        if imbalance > 25:
            recs.append({
                "priority": "medium",
                "category": "Layout Optimization",
                "title": "Shelf Distribution Imbalance",
                "description": f"Product distribution across shelves is {imbalance}% imbalanced. "
                               "Some shelves are overcrowded while others are sparse.",
                "impact": "Medium - Suboptimal space utilization",
                "action": "Rebalance products across shelf levels",
            })

        stockout = kpis["stockout_probability"]["value"]
        if stockout > 30:
            recs.append({
                "priority": "high",
                "category": "Supply Chain",
                "title": "High Stockout Risk Alert",
                "description": f"Stockout probability is {stockout}%. "
                               "Multiple categories at risk of running out.",
                "impact": "High - Direct revenue and customer satisfaction impact",
                "action": "Expedite supply chain orders for at-risk categories",
            })

        # Always add an optimization recommendation
        recs.append({
            "priority": "low",
            "category": "Optimization",
            "title": "Continuous Monitoring Recommendation",
            "description": "Schedule regular shelf scans (every 2-4 hours) to maintain "
                           "optimal KPI levels and catch issues early.",
            "impact": "Low - Preventive measure for sustained performance",
            "action": "Set up automated scanning schedule",
        })

        return sorted(recs, key=lambda r: {"high": 0, "medium": 1, "low": 2}[r["priority"]])

    def _generate_alerts(self, kpis, visual_signals):
        """Generate real-time alerts based on KPI thresholds."""
        alerts = []

        for kpi_name, kpi_data in kpis.items():
            if kpi_data["status"] == "critical":
                alerts.append({
                    "type": "critical",
                    "kpi": kpi_name,
                    "title": f"Critical: {kpi_data['description']}",
                    "value": f"{kpi_data['value']}{kpi_data['unit']}",
                    "target": f"{kpi_data['target']}{kpi_data['unit']}",
                    "timestamp": "Real-time",
                })
            elif kpi_data["status"] == "warning":
                alerts.append({
                    "type": "warning",
                    "kpi": kpi_name,
                    "title": f"Warning: {kpi_data['description']}",
                    "value": f"{kpi_data['value']}{kpi_data['unit']}",
                    "target": f"{kpi_data['target']}{kpi_data['unit']}",
                    "timestamp": "Real-time",
                })

        return sorted(alerts, key=lambda a: 0 if a["type"] == "critical" else 1)
