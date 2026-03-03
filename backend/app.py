"""
Retail Shelf Monitoring & KPI Risk Analysis - Flask Backend
Main application server with REST API endpoints.
Serves both the API and the production React frontend.
Enterprise Edition: DB persistence, auth, multi-store, audit, YOLOv8, Swagger.
"""

import os
import json
import uuid
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_swagger_ui import get_swaggerui_blueprint

from detection.detector import ShelfDetector
from detection.yolo_detector import YOLOShelfDetector
from analytics.kpi_engine import KPIEngine
from analytics.sales_data import SalesDataProvider
from models.database import db, init_db, User, Store, Analysis, AuditLog
from auth.auth import auth_bp, token_required, admin_required
from middleware.logging_middleware import init_logging

# Path to the built React frontend
FRONTEND_BUILD = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'dist')

app = Flask(__name__, static_folder=FRONTEND_BUILD, static_url_path='')
CORS(app, resources={r"/api/*": {"origins": "*"}})
app.config['SECRET_KEY'] = os.environ.get('JWT_SECRET', 'shelfguard-ai-secret-key')

# Initialize database
init_db(app)

# Initialize logging middleware
init_logging(app)

# Register auth blueprint
app.register_blueprint(auth_bp)

# Configuration
UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Initialize detection modules
detector_opencv = ShelfDetector()
detector_yolo = YOLOShelfDetector()
kpi_engine = KPIEngine()
sales_provider = SalesDataProvider()

# Legacy in-memory storage (kept for backward compatibility)
analysis_history = []

# ---- Swagger API Documentation ----
SWAGGER_URL = '/api/docs'
API_URL = '/api/swagger.json'
swaggerui_blueprint = get_swaggerui_blueprint(SWAGGER_URL, API_URL, config={'app_name': 'ShelfGuard AI API'})
app.register_blueprint(swaggerui_blueprint, url_prefix=SWAGGER_URL)


@app.route('/api/swagger.json')
def swagger_spec():
    """Return the Swagger/OpenAPI specification."""
    spec = {
        "openapi": "3.0.0",
        "info": {
            "title": "ShelfGuard AI API",
            "version": "2.0.0",
            "description": "Retail Shelf Monitoring & KPI Risk Analysis API"
        },
        "paths": {
            "/api/health": {
                "get": {"summary": "Health check", "tags": ["System"],
                        "responses": {"200": {"description": "Server status"}}}
            },
            "/api/analyze": {
                "post": {"summary": "Analyze shelf image", "tags": ["Analysis"],
                         "requestBody": {"content": {"multipart/form-data": {
                             "schema": {"type": "object", "properties": {
                                 "image": {"type": "string", "format": "binary"},
                                 "detection_mode": {"type": "string", "enum": ["opencv", "yolov8"]},
                                 "store_id": {"type": "integer"}
                             }}}}},
                         "responses": {"200": {"description": "Analysis results"}}}
            },
            "/api/history": {
                "get": {"summary": "Get analysis history", "tags": ["Analysis"],
                        "parameters": [
                            {"name": "store_id", "in": "query", "schema": {"type": "integer"}},
                            {"name": "risk_level", "in": "query", "schema": {"type": "string"}},
                            {"name": "start_date", "in": "query", "schema": {"type": "string", "format": "date"}},
                            {"name": "end_date", "in": "query", "schema": {"type": "string", "format": "date"}},
                        ],
                        "responses": {"200": {"description": "Analysis history"}}}
            },
            "/api/auth/register": {
                "post": {"summary": "Register new user", "tags": ["Auth"],
                         "responses": {"201": {"description": "User created"}}}
            },
            "/api/auth/login": {
                "post": {"summary": "User login", "tags": ["Auth"],
                         "responses": {"200": {"description": "JWT token"}}}
            },
            "/api/stores": {
                "get": {"summary": "List all stores", "tags": ["Stores"],
                        "responses": {"200": {"description": "Store list"}}}
            },
            "/api/admin/analytics": {
                "get": {"summary": "Admin analytics dashboard data", "tags": ["Admin"],
                        "responses": {"200": {"description": "Aggregate analytics"}}}
            },
            "/api/admin/audit-logs": {
                "get": {"summary": "View audit logs", "tags": ["Admin"],
                        "responses": {"200": {"description": "Audit log entries"}}}
            },
        }
    }
    return jsonify(spec)


# ---- Serve React Frontend ----
@app.route('/')
def serve_frontend():
    """Serve the React frontend."""
    if os.path.exists(os.path.join(FRONTEND_BUILD, 'index.html')):
        return send_from_directory(FRONTEND_BUILD, 'index.html')
    return jsonify({
        "message": "ShelfGuard AI API is running. Frontend not built yet.",
        "hint": "Run 'npm run build' in the frontend/ directory first.",
    })


# ---- API Endpoints ----
@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({
        "status": "healthy",
        "service": "Retail Shelf Monitor API",
        "version": "2.0.0",
        "timestamp": datetime.now().isoformat(),
        "modules": {
            "detector_opencv": "YOLOv8-Shelf-Detector (OpenCV)",
            "detector_yolo": "Available" if detector_yolo.is_available else "Not installed (pip install ultralytics)",
            "kpi_engine": "Random Forest Classifier (9 KPIs)",
            "sales_data": "Simulated Provider",
            "database": "Connected",
            "auth": "JWT + bcrypt",
        },
        "demo_mode": os.environ.get('DEMO_MODE', 'true').lower() == 'true',
    })


@app.route('/api/analyze', methods=['POST'])
@token_required
def analyze_shelf():
    """
    Main analysis endpoint.
    Accepts shelf image, runs detection, computes KPIs, predicts risk.
    Now persists results to database.
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

    # Get optional parameters
    detection_mode = request.form.get('detection_mode', 'opencv')
    store_id = request.form.get('store_id', None)
    if store_id:
        try:
            store_id = int(store_id)
        except (ValueError, TypeError):
            store_id = None

    try:
        # Read image bytes
        image_bytes = file.read()

        # Step 1: Object Detection (choose mode)
        if detection_mode == 'yolov8':
            detection_results = detector_yolo.detect(image_bytes)
        else:
            detection_results = detector_opencv.detect(image_bytes)

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
            "detection_mode": detection_mode,
            "store_id": store_id,
        }

        # Legacy in-memory storage
        analysis_history.append({
            "id": analysis_id,
            "timestamp": result["timestamp"],
            "summary": detection_results["summary"],
            "risk_level": kpi_results["risk_prediction"]["overall_risk"],
        })
        if len(analysis_history) > 50:
            analysis_history.pop(0)

        # Persist to database
        try:
            user_id = request.current_user.id if hasattr(request, 'current_user') and request.current_user else None
            if not store_id:
                default_store = Store.query.first()
                store_id = default_store.id if default_store else None

            analysis_record = Analysis.from_result(
                analysis_id, result,
                user_id=user_id,
                store_id=store_id,
                filename=file.filename,
                detection_mode=detection_mode
            )
            db.session.add(analysis_record)
            db.session.commit()

            AuditLog.log('upload', f'Image analyzed: {file.filename} (mode: {detection_mode})',
                         user_id=user_id, ip_address=request.remote_addr)
        except Exception as db_err:
            db.session.rollback()
            print(f"DB persist warning: {db_err}")

        return jsonify(result)

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/history', methods=['GET'])
@token_required
def get_history():
    """Get analysis history with filters."""
    store_id = request.args.get('store_id', type=int)
    risk_level = request.args.get('risk_level', type=str)
    start_date = request.args.get('start_date', type=str)
    end_date = request.args.get('end_date', type=str)
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 50, type=int)

    try:
        query = Analysis.query.order_by(Analysis.created_at.desc())

        if store_id:
            query = query.filter(Analysis.store_id == store_id)
        if risk_level:
            query = query.filter(Analysis.risk_level == risk_level)
        if start_date:
            try:
                sd = datetime.fromisoformat(start_date)
                query = query.filter(Analysis.created_at >= sd)
            except ValueError:
                pass
        if end_date:
            try:
                ed = datetime.fromisoformat(end_date)
                query = query.filter(Analysis.created_at <= ed)
            except ValueError:
                pass

        total = query.count()
        analyses = query.offset((page - 1) * per_page).limit(per_page).all()

        return jsonify({
            "history": [a.to_dict() for a in analyses],
            "total": total,
            "page": page,
            "per_page": per_page,
            "pages": (total + per_page - 1) // per_page,
        })
    except Exception:
        # Fallback to legacy in-memory history
        return jsonify({
            "history": list(reversed(analysis_history)),
            "total": len(analysis_history),
        })


@app.route('/api/history/export', methods=['GET'])
@token_required
def export_history():
    """Export analysis history as CSV."""
    store_id = request.args.get('store_id', type=int)
    risk_level = request.args.get('risk_level', type=str)

    query = Analysis.query.order_by(Analysis.created_at.desc())
    if store_id:
        query = query.filter(Analysis.store_id == store_id)
    if risk_level:
        query = query.filter(Analysis.risk_level == risk_level)

    analyses = query.all()

    csv_lines = [
        "analysis_id,date,store,detection_mode,products,empty_slots,misplaced,"
        "occupancy,empty_severity,imbalance,misplacement,density,sell_through,"
        "stockout_prob,revenue_at_risk,planogram_compliance,risk_level,confidence"
    ]
    for a in analyses:
        store_name = a.store.store_name if a.store else 'N/A'
        csv_lines.append(
            f"{a.analysis_id},{a.created_at.isoformat()},{store_name},{a.detection_mode},"
            f"{a.product_count},{a.empty_slot_count},{a.misplaced_count},"
            f"{a.kpi_shelf_occupancy},{a.kpi_empty_severity},{a.kpi_shelf_imbalance},"
            f"{a.kpi_misplacement_rate},{a.kpi_product_density},{a.kpi_sell_through},"
            f"{a.kpi_stockout_prob},{a.kpi_revenue_at_risk},{a.kpi_planogram_compliance},"
            f"{a.risk_level},{a.model_confidence}"
        )

    csv_content = "\n".join(csv_lines)
    return csv_content, 200, {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename=shelfguard_analysis_export.csv'
    }


@app.route('/api/kpi/explain', methods=['POST'])
def explain_risk():
    """Provide explainable AI breakdown for a specific risk prediction."""
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

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


# ---- Store Management ----
@app.route('/api/stores', methods=['GET'])
def list_stores():
    """List all stores."""
    stores = Store.query.all()
    return jsonify({"stores": [s.to_dict() for s in stores]})


@app.route('/api/stores', methods=['POST'])
@admin_required
def create_store():
    """Create a new store (admin only)."""
    data = request.get_json()
    if not data or not data.get('store_name'):
        return jsonify({"error": "store_name is required"}), 400

    store = Store(
        store_name=data['store_name'],
        location=data.get('location', '')
    )
    db.session.add(store)
    db.session.commit()

    AuditLog.log('admin_action', f'Store created: {store.store_name}',
                 user_id=getattr(request, 'current_user', None) and request.current_user.id,
                 ip_address=request.remote_addr)

    return jsonify({"store": store.to_dict()}), 201


# ---- Admin Analytics Dashboard ----
@app.route('/api/admin/analytics', methods=['GET'])
@admin_required
def admin_analytics():
    """Admin-only analytics dashboard data."""
    total_uploads = Analysis.query.count()

    risk_dist = {
        "Low": Analysis.query.filter_by(risk_level="Low").count(),
        "Medium": Analysis.query.filter_by(risk_level="Medium").count(),
        "High": Analysis.query.filter_by(risk_level="High").count(),
    }

    # Average KPIs across all analyses
    analyses = Analysis.query.all()
    if analyses:
        avg_confidence = round(sum(a.model_confidence for a in analyses) / len(analyses), 3)
        avg_occupancy = round(sum(a.kpi_shelf_occupancy for a in analyses) / len(analyses), 1)
        avg_empty_severity = round(sum(a.kpi_empty_severity for a in analyses) / len(analyses), 1)
        avg_revenue_at_risk = round(sum(a.kpi_revenue_at_risk for a in analyses) / len(analyses), 2)
        avg_planogram = round(sum(a.kpi_planogram_compliance for a in analyses) / len(analyses), 1)

        # Average feature importance
        all_importance = []
        for a in analyses:
            if a.feature_importance_json:
                try:
                    all_importance.append(json.loads(a.feature_importance_json))
                except json.JSONDecodeError:
                    pass

        avg_feature_importance = []
        if all_importance:
            feature_sums = {}
            for imp_list in all_importance:
                for item in imp_list:
                    name = item['feature']
                    if name not in feature_sums:
                        feature_sums[name] = []
                    feature_sums[name].append(item['importance'])
            avg_feature_importance = [
                {"feature": name, "importance": round(sum(vals) / len(vals), 4)}
                for name, vals in feature_sums.items()
            ]
            avg_feature_importance.sort(key=lambda x: x['importance'], reverse=True)

        # Confidence distribution
        confidence_buckets = {"0-50%": 0, "50-70%": 0, "70-85%": 0, "85-100%": 0}
        for a in analyses:
            c = a.model_confidence * 100
            if c < 50:
                confidence_buckets["0-50%"] += 1
            elif c < 70:
                confidence_buckets["50-70%"] += 1
            elif c < 85:
                confidence_buckets["70-85%"] += 1
            else:
                confidence_buckets["85-100%"] += 1

        # Per-store breakdown
        store_breakdown = {}
        for a in analyses:
            sname = a.store.store_name if a.store else 'Unknown'
            if sname not in store_breakdown:
                store_breakdown[sname] = {"count": 0, "risk_high": 0, "avg_occupancy": []}
            store_breakdown[sname]["count"] += 1
            if a.risk_level == "High":
                store_breakdown[sname]["risk_high"] += 1
            store_breakdown[sname]["avg_occupancy"].append(a.kpi_shelf_occupancy)

        for sname in store_breakdown:
            occ_list = store_breakdown[sname]["avg_occupancy"]
            store_breakdown[sname]["avg_occupancy"] = round(sum(occ_list) / len(occ_list), 1) if occ_list else 0
    else:
        avg_confidence = 0
        avg_occupancy = 0
        avg_empty_severity = 0
        avg_revenue_at_risk = 0
        avg_planogram = 0
        avg_feature_importance = []
        confidence_buckets = {}
        store_breakdown = {}

    return jsonify({
        "total_uploads": total_uploads,
        "risk_distribution": risk_dist,
        "avg_risk_score": avg_confidence,
        "avg_kpis": {
            "occupancy": avg_occupancy,
            "empty_severity": avg_empty_severity,
            "revenue_at_risk": avg_revenue_at_risk,
            "planogram_compliance": avg_planogram,
        },
        "avg_feature_importance": avg_feature_importance,
        "confidence_distribution": confidence_buckets,
        "store_breakdown": store_breakdown,
        "total_users": User.query.count(),
        "total_stores": Store.query.count(),
    })


# ---- Audit Logs ----
@app.route('/api/admin/audit-logs', methods=['GET'])
@admin_required
def get_audit_logs():
    """Get audit logs (admin only)."""
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 50, type=int)
    action_filter = request.args.get('action', type=str)

    query = AuditLog.query.order_by(AuditLog.created_at.desc())
    if action_filter:
        query = query.filter(AuditLog.action == action_filter)

    total = query.count()
    logs = query.offset((page - 1) * per_page).limit(per_page).all()

    return jsonify({
        "logs": [l.to_dict() for l in logs],
        "total": total,
        "page": page,
        "per_page": per_page,
    })


# ---- Cross-Store Comparison ----
@app.route('/api/stores/compare', methods=['GET'])
@token_required
def compare_stores():
    """Cross-store risk comparison."""
    stores = Store.query.all()
    comparison = []

    for store in stores:
        analyses = Analysis.query.filter_by(store_id=store.id).order_by(Analysis.created_at.desc()).limit(10).all()
        if analyses:
            comparison.append({
                "store_id": store.id,
                "store_name": store.store_name,
                "location": store.location,
                "total_analyses": len(analyses),
                "avg_occupancy": round(sum(a.kpi_shelf_occupancy for a in analyses) / len(analyses), 1),
                "avg_risk": round(sum(a.risk_level_int for a in analyses) / len(analyses), 2),
                "latest_risk": analyses[0].risk_level if analyses else "N/A",
                "high_risk_count": sum(1 for a in analyses if a.risk_level == "High"),
                "avg_planogram": round(sum(a.kpi_planogram_compliance for a in analyses) / len(analyses), 1),
            })

    return jsonify({"comparison": comparison})


# ---- Catch-all for React SPA ----
@app.route('/<path:path>')
def serve_static(path):
    """Serve static files from the React build, fall back to index.html for SPA routing."""
    file_path = os.path.join(FRONTEND_BUILD, path)
    if os.path.exists(file_path) and os.path.isfile(file_path):
        return send_from_directory(FRONTEND_BUILD, path)
    if os.path.exists(os.path.join(FRONTEND_BUILD, 'index.html')):
        return send_from_directory(FRONTEND_BUILD, 'index.html')
    return jsonify({"error": "Not found"}), 404


if __name__ == '__main__':
    print("\n" + "=" * 60)
    print("  ShelfGuard AI - Enterprise Edition v2.0")
    print("  API + Frontend Server")
    print("  Starting on http://localhost:5000")
    print("  API Docs: http://localhost:5000/api/docs")
    print("=" * 60 + "\n")
    app.run(debug=True, host='0.0.0.0', port=5000)
