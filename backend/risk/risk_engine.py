"""
Risk Analytics Engine
6-level risk classification using combined KPIs from both models.
Trained Random Forest on synthetic data with clear decision boundaries.
"""

import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler


RISK_LEVELS = {
    0: {"label": "No Risk", "color": "#22c55e", "icon": "✅"},
    1: {"label": "Stable", "color": "#3b82f6", "icon": "🟢"},
    2: {"label": "Slight Risk", "color": "#eab308", "icon": "🟡"},
    3: {"label": "Moderate Risk", "color": "#f97316", "icon": "🟠"},
    4: {"label": "High Risk", "color": "#ef4444", "icon": "🔴"},
    5: {"label": "Critical Risk", "color": "#dc2626", "icon": "🚨"},
}


class RiskEngine:
    """
    Predicts shelf risk using combined features from YOLOv8 + Depth Anything V2.
    Outputs a 6-level risk classification with feature importance.
    """

    FEATURE_NAMES = [
        "Surface Occupancy",
        "Depth Occupancy",
        "Shelf Balance",
        "Hollow Score",
        "Rear Empty Ratio",
        "False Fullness Risk",
        "Product Density",
        "Spread Score",
        "Occupancy Gap",
        "Consistency Score",
    ]

    def __init__(self):
        self.model = None
        self.scaler = StandardScaler()
        self._train_model()

    def _train_model(self):
        """Train Random Forest on synthetic data with 6 risk levels."""
        np.random.seed(42)
        n = 2000

        # Generate synthetic features
        surface_occ = np.random.uniform(0.1, 1.0, n)
        depth_occ = np.random.uniform(0.1, 1.0, n)
        balance = np.random.uniform(0.0, 1.0, n)
        hollow = np.random.uniform(0.0, 1.0, n)
        rear_empty = np.random.uniform(0.0, 1.0, n)
        ffr = np.random.uniform(0.0, 1.0, n)
        density = np.random.uniform(0.0, 15.0, n)
        spread = np.random.uniform(0.0, 1.0, n)
        occ_gap = np.abs(surface_occ - depth_occ)
        consistency = 1.0 - np.mean([occ_gap, hollow, ffr], axis=0)

        X = np.column_stack([
            surface_occ, depth_occ, balance, hollow, rear_empty,
            ffr, density / 15.0, spread, occ_gap, consistency,
        ])

        # Risk score formula
        risk_score = (
            (1 - surface_occ) * 0.12 +
            (1 - depth_occ) * 0.18 +
            (1 - balance) * 0.08 +
            hollow * 0.15 +
            rear_empty * 0.15 +
            ffr * 0.12 +
            (1 - density / 15.0) * 0.05 +
            (1 - spread) * 0.05 +
            occ_gap * 0.05 +
            (1 - consistency) * 0.05
        )

        # Map to 6 levels
        y = np.zeros(n, dtype=int)
        y[risk_score > 0.15] = 1  # Stable
        y[risk_score > 0.30] = 2  # Slight Risk
        y[risk_score > 0.45] = 3  # Moderate Risk
        y[risk_score > 0.60] = 4  # High Risk
        y[risk_score > 0.75] = 5  # Critical Risk

        self.scaler.fit(X)
        X_scaled = self.scaler.transform(X)

        self.model = RandomForestClassifier(
            n_estimators=150,
            max_depth=12,
            random_state=42,
            class_weight='balanced',
        )
        self.model.fit(X_scaled, y)

    def predict(self, yolo_metrics, depth_metrics, consistency_score):
        """
        Predict risk level from combined model outputs.
        Returns risk level, probabilities, feature importance.
        """
        features = self._extract_features(yolo_metrics, depth_metrics, consistency_score)
        features_array = np.array([features])
        features_scaled = self.scaler.transform(features_array)

        prediction = int(self.model.predict(features_scaled)[0])
        probabilities = self.model.predict_proba(features_scaled)[0]

        # Feature importance
        importance = self.model.feature_importances_
        feature_importance = [
            {"feature": name, "importance": round(float(imp), 4), "value": round(float(val), 3)}
            for name, imp, val in sorted(
                zip(self.FEATURE_NAMES, importance, features),
                key=lambda x: x[1], reverse=True
            )
        ]

        risk_info = RISK_LEVELS[prediction]
        confidence = round(float(max(probabilities)), 3)

        return {
            "risk_level": prediction,
            "risk_label": risk_info["label"],
            "risk_color": risk_info["color"],
            "risk_icon": risk_info["icon"],
            "confidence": confidence,
            "probabilities": {
                RISK_LEVELS[i]["label"]: round(float(probabilities[i]), 3)
                for i in range(len(probabilities))
            },
            "feature_importance": feature_importance,
            "model_info": {
                "algorithm": "Random Forest Classifier",
                "n_estimators": 150,
                "n_features": len(self.FEATURE_NAMES),
                "n_classes": 6,
            },
        }

    def _extract_features(self, yolo, depth, consistency_score):
        """Extract the 10 features from both model outputs."""
        surface_occ = yolo.get("occupancy_ratio", 0.5)
        depth_occ = depth.get("depth_occupancy_score", 0.5)
        balance = yolo.get("shelf_balance_score", 0.5)
        hollow = depth.get("hollow_shelf_score", 0)
        rear_empty = depth.get("rear_empty_ratio", 0)
        ffr = depth.get("false_fullness_risk", 0)
        density = min(yolo.get("shelf_density", 5) / 15.0, 1.0)
        spread = yolo.get("spread_score", 0.5)
        occ_gap = abs(surface_occ - depth_occ)
        consistency = consistency_score / 100.0

        return [
            surface_occ, depth_occ, balance, hollow, rear_empty,
            ffr, density, spread, occ_gap, consistency,
        ]
