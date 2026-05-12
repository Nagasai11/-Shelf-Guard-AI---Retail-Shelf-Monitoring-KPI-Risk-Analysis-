"""
ShelfGuard AI — Dual-Model Shelf KPI Risk Comparison System
Flask backend serving the analysis API and React frontend.

Two AI models analyze the same shelf image independently:
  1. YOLOv8 → product detection, surface occupancy
  2. Depth Anything V2 → depth estimation, rear empty analysis

Results are compared to generate meaningful KPI risk analysis.
"""

import os
import uuid
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

from detection.yolov8_pipeline import YOLOv8Pipeline
from depth.depth_anything_pipeline import DepthAnythingPipeline
from analytics.kpi_comparison import KPIComparisonEngine
from risk.risk_engine import RiskEngine

# Path to built React frontend
FRONTEND_BUILD = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'dist')

app = Flask(__name__, static_folder=FRONTEND_BUILD, static_url_path='')
CORS(app, resources={r"/api/*": {"origins": "*"}})

# Upload folder
UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Initialize pipelines (loaded once at startup)
print("[*] Loading YOLOv8 pipeline...")
yolo_pipeline = YOLOv8Pipeline()
print(f"[OK] YOLOv8: {'Real model' if yolo_pipeline.is_real_yolo else 'OpenCV fallback'}")

print("[*] Loading Depth Anything V2 pipeline...")
depth_pipeline = DepthAnythingPipeline()
print(f"[OK] Depth: {'Real model' if depth_pipeline.is_real_model else 'OpenCV approximation'}")

print("[*] Loading KPI Comparison Engine...")
comparison_engine = KPIComparisonEngine()
print("[OK] KPI Comparison Engine ready")

print("[*] Training Risk Engine (Random Forest)...")
risk_engine = RiskEngine()
print("[OK] Risk Engine ready (6-level classification)")


# ---- Serve React Frontend ----
@app.route('/')
def serve_frontend():
    if os.path.exists(os.path.join(FRONTEND_BUILD, 'index.html')):
        return send_from_directory(FRONTEND_BUILD, 'index.html')
    return jsonify({
        "message": "ShelfGuard AI API is running. Frontend not built.",
        "hint": "Run 'npm run build' in frontend/ directory.",
    })


# ---- API: Health Check ----
@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({
        "status": "healthy",
        "service": "ShelfGuard AI — Dual-Model KPI Risk Comparison",
        "version": "3.0.0",
        "timestamp": datetime.now().isoformat(),
        "models": {
            "yolov8": {
                "status": "active",
                "real_model": yolo_pipeline.is_real_yolo,
                "name": "YOLOv8" if yolo_pipeline.is_real_yolo else "YOLOv8-OpenCV-Fallback",
            },
            "depth_anything": {
                "status": "active",
                "real_model": depth_pipeline.is_real_model,
                "name": "Depth-Anything-V2" if depth_pipeline.is_real_model else "Depth-OpenCV-Approximation",
            },
            "risk_engine": {
                "status": "active",
                "algorithm": "Random Forest (6-level)",
            },
        },
    })


# ---- API: Main Analysis Endpoint ----
@app.route('/api/analyze', methods=['POST'])
def analyze_shelf():
    """
    Main endpoint: Analyze a shelf image with BOTH models.
    Returns detection, depth analysis, KPI comparison, and risk prediction.
    """
    if 'image' not in request.files:
        return jsonify({"error": "No image file provided"}), 400

    file = request.files['image']
    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400

    allowed_ext = {'png', 'jpg', 'jpeg', 'webp', 'bmp'}
    ext = file.filename.rsplit('.', 1)[-1].lower() if '.' in file.filename else ''
    if ext not in allowed_ext:
        return jsonify({"error": f"File type '.{ext}' not allowed"}), 400

    try:
        image_bytes = file.read()
        analysis_id = str(uuid.uuid4())[:8]

        # ---- Run both models independently ----

        # Model 1: YOLOv8 (product detection + surface occupancy)
        yolo_result = yolo_pipeline.run(image_bytes)

        # Model 2: Depth Anything V2 (depth estimation + rear analysis)
        depth_result = depth_pipeline.run(image_bytes)

        # ---- Compare outputs ----
        comparison = comparison_engine.compare(yolo_result, depth_result)

        # ---- Predict risk using combined features ----
        risk = risk_engine.predict(
            yolo_result["kpi_metrics"],
            depth_result["kpi_metrics"],
            comparison["consistency_score"]["score"],
        )

        # ---- Build response ----
        result = {
            "analysis_id": analysis_id,
            "timestamp": datetime.now().isoformat(),
            "filename": file.filename,

            # Model 1 output
            "yolo": {
                "model_name": yolo_result["model_name"],
                "is_real_model": yolo_result["is_real_model"],
                "annotated_image": yolo_result["annotated_image"],
                "occupancy_mask": yolo_result["occupancy_mask"],
                "summary": yolo_result["summary"],
                "kpi_metrics": yolo_result["kpi_metrics"],
                "detections": yolo_result["detections"],
            },

            # Model 2 output
            "depth": {
                "model_name": depth_result["model_name"],
                "is_real_model": depth_result["is_real_model"],
                "depth_heatmap": depth_result["depth_heatmap"],
                "hollow_overlay": depth_result["hollow_overlay"],
                "summary": depth_result["summary"],
                "kpi_metrics": depth_result["kpi_metrics"],
                "depth_analysis": depth_result["depth_analysis"],
                "hollow_regions": depth_result["hollow_regions"],
            },

            # Comparison results (MAIN FEATURE)
            "comparison": comparison,

            # Risk prediction
            "risk": risk,
        }

        return jsonify(result)

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# ---- Catch-all for React SPA ----
@app.route('/<path:path>')
def serve_static(path):
    file_path = os.path.join(FRONTEND_BUILD, path)
    if os.path.exists(file_path) and os.path.isfile(file_path):
        return send_from_directory(FRONTEND_BUILD, path)
    if os.path.exists(os.path.join(FRONTEND_BUILD, 'index.html')):
        return send_from_directory(FRONTEND_BUILD, 'index.html')
    return jsonify({"error": "Not found"}), 404


if __name__ == '__main__':
    print("\n" + "=" * 60)
    print("  ShelfGuard AI v3.0")
    print("  Dual-Model KPI Risk Comparison System")
    print("  http://localhost:5000")
    print("=" * 60 + "\n")
    app.run(debug=True, host='0.0.0.0', port=5000)
