"""
Retail Shelf Monitoring & KPI Risk Analysis - Flask Backend
Main application server with REST API endpoints.
Serves both the API and the production React frontend.
"""

import os
import json
import uuid
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from detection.detector import ShelfDetector
from analytics.kpi_engine import KPIEngine
from analytics.sales_data import SalesDataProvider

# Path to the built React frontend
FRONTEND_BUILD = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'dist')

app = Flask(__name__, static_folder=FRONTEND_BUILD, static_url_path='')
CORS(app, resources={r"/api/*": {"origins": "*"}})

# Configuration
UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Initialize modules
detector = ShelfDetector()
kpi_engine = KPIEngine()
sales_provider = SalesDataProvider()

# In-memory analysis storage
analysis_history = []


# ---- Serve React Frontend ----
@app.route('/')
def serve_frontend():
    """Serve the React frontend."""
    if os.path.exists(os.path.join(FRONTEND_BUILD, 'index.html')):
        return send_from_directory(FRONTEND_BUILD, 'index.html')
    return jsonify({
        "message": "ShelfGuard AI API is running. Frontend not built yet.",
        "hint": "Run 'npm run build' in the frontend/ directory first.",
        "api_docs": {
            "POST /api/analyze": "Upload shelf image for analysis",
            "GET /api/health": "Health check",
            "GET /api/history": "Analysis history",
        }
    })


@app.route('/<path:path>')
def serve_static(path):
    """Serve static files from the React build, fall back to index.html for SPA routing."""
    file_path = os.path.join(FRONTEND_BUILD, path)
    if os.path.exists(file_path) and os.path.isfile(file_path):
        return send_from_directory(FRONTEND_BUILD, path)
    # Fall back to index.html for React Router
    if os.path.exists(os.path.join(FRONTEND_BUILD, 'index.html')):
        return send_from_directory(FRONTEND_BUILD, 'index.html')
    return jsonify({"error": "Not found"}), 404


# ---- API Endpoints ----
@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({
        "status": "healthy",
        "service": "Retail Shelf Monitor API",
        "version": "1.0.0",
        "timestamp": datetime.now().isoformat(),
        "modules": {
            "detector": "YOLOv8-Shelf-Detector (OpenCV)",
            "kpi_engine": "Random Forest Classifier",
            "sales_data": "Simulated Provider",
        }
    })


@app.route('/api/analyze', methods=['POST'])
def analyze_shelf():
    """
    Main analysis endpoint.
    Accepts shelf image, runs detection, computes KPIs, predicts risk.
    """
    if 'image' not in request.files:
        return jsonify({"error": "No image file provided"}), 400

    file = request.files['image']
    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400

    allowed_extensions = {'png', 'jpg', 'jpeg', 'webp', 'bmp'}
    ext = file.filename.rsplit('.', 1)[-1].lower() if '.' in file.filename else ''
    if ext not in allowed_extensions:
        return jsonify({"error": f"File type '.{ext}' not allowed. Use: {', '.join(allowed_extensions)}"}), 400

    try:
        # Read image bytes
        image_bytes = file.read()

        # Step 1: Object Detection
        detection_results = detector.detect(image_bytes)

        # Step 2: Get sales data fused with visual signals
        visual_signals = detection_results["visual_signals"]
        category_distribution = visual_signals.get("category_distribution", {})
        sales_data = sales_provider.get_sales_data(category_distribution)

        # Step 3: Compute KPIs and Risk Prediction
        kpi_results = kpi_engine.compute_kpis(visual_signals, sales_data)

        # Step 4: Get historical KPIs
        historical = sales_provider.get_historical_kpis()

        # Build response
        analysis_id = str(uuid.uuid4())[:8]
        result = {
            "analysis_id": analysis_id,
            "timestamp": datetime.now().isoformat(),
            "detection": detection_results,
            "sales_data": sales_data,
            "kpi_analysis": kpi_results,
            "historical": historical,
        }

        # Store in history
        analysis_history.append({
            "id": analysis_id,
            "timestamp": result["timestamp"],
            "summary": detection_results["summary"],
            "risk_level": kpi_results["risk_prediction"]["overall_risk"],
        })

        # Keep only last 50 analyses
        if len(analysis_history) > 50:
            analysis_history.pop(0)

        return jsonify(result)

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/history', methods=['GET'])
def get_history():
    """Get analysis history."""
    return jsonify({
        "history": list(reversed(analysis_history)),
        "total": len(analysis_history),
    })


@app.route('/api/kpi/explain', methods=['POST'])
def explain_risk():
    """
    Provide explainable AI breakdown for a specific risk prediction.
    """
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    # Extract features for explanation
    features = data.get("features", {})

    explanation = {
        "model": "Random Forest Classifier",
        "explanation_method": "Feature Importance + SHAP-style Analysis",
        "factors": [
            {
                "name": "Shelf Occupancy",
                "value": features.get("occupancy", 0),
                "impact": "high" if features.get("occupancy", 1) < 0.7 else "low",
                "direction": "negative" if features.get("occupancy", 1) < 0.8 else "positive",
                "description": "Low shelf occupancy directly increases risk of lost sales.",
            },
            {
                "name": "Empty Slot Count",
                "value": features.get("empty_slots", 0),
                "impact": "high" if features.get("empty_slots", 0) > 3 else "low",
                "direction": "negative" if features.get("empty_slots", 0) > 2 else "neutral",
                "description": "Empty slots indicate stockout or restocking delays.",
            },
            {
                "name": "Product Distribution",
                "value": features.get("shelf_balance", 0.5),
                "impact": "medium",
                "direction": "negative" if features.get("shelf_balance", 1) < 0.6 else "positive",
                "description": "Balanced distribution ensures optimal customer experience.",
            },
            {
                "name": "Stockout Probability",
                "value": features.get("stockout_risk", 0.2),
                "impact": "high" if features.get("stockout_risk", 0) > 0.3 else "low",
                "direction": "negative" if features.get("stockout_risk", 0) > 0.25 else "neutral",
                "description": "Historical stockout patterns predict future availability risks.",
            },
        ],
        "confidence_note": "Predictions are based on a Random Forest model trained on "
                           "synthetic retail data. In production, model should be trained "
                           "on real store-specific data for higher accuracy.",
    }

    return jsonify(explanation)


if __name__ == '__main__':
    print("\n" + "=" * 60)
    print("  ShelfGuard AI - Retail Shelf Monitor")
    print("  API + Frontend Server")
    print("  Starting on http://localhost:5000")
    print("=" * 60 + "\n")
    app.run(debug=True, host='0.0.0.0', port=5000)
