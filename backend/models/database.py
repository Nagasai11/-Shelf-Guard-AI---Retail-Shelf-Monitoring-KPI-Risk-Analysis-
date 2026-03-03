"""
Database Models — SQLAlchemy ORM
Stores users, stores, analyses, KPIs, and audit logs.
Uses SQLite locally, PostgreSQL in production.
"""

import os
from datetime import datetime
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


def get_database_url():
    """Get database URL from environment or default to SQLite."""
    return os.environ.get('DATABASE_URL', 'sqlite:///shelfguard.db').replace(
        'postgres://', 'postgresql://'  # Render fix
    )


def init_db(app):
    """Initialize database with the Flask app."""
    app.config['SQLALCHEMY_DATABASE_URI'] = get_database_url()
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    db.init_app(app)
    with app.app_context():
        db.create_all()
        _seed_default_store()


def _seed_default_store():
    """Ensure a default store exists."""
    if not Store.query.first():
        default = Store(store_name='Main Store', location='Default Location')
        db.session.add(default)
        db.session.commit()


# ---- Models ----

class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    role = db.Column(db.String(20), default='manager')  # admin, manager
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_login = db.Column(db.DateTime, nullable=True)

    analyses = db.relationship('Analysis', backref='user', lazy=True)
    audit_logs = db.relationship('AuditLog', backref='user', lazy=True)

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'role': self.role,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'last_login': self.last_login.isoformat() if self.last_login else None,
        }


class Store(db.Model):
    __tablename__ = 'stores'
    id = db.Column(db.Integer, primary_key=True)
    store_name = db.Column(db.String(100), nullable=False)
    location = db.Column(db.String(200), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    analyses = db.relationship('Analysis', backref='store', lazy=True)

    def to_dict(self):
        return {
            'id': self.id,
            'store_name': self.store_name,
            'location': self.location,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class Analysis(db.Model):
    __tablename__ = 'analyses'
    id = db.Column(db.Integer, primary_key=True)
    analysis_id = db.Column(db.String(20), unique=True, nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    store_id = db.Column(db.Integer, db.ForeignKey('stores.id'), nullable=True)
    filename = db.Column(db.String(200), nullable=True)
    detection_mode = db.Column(db.String(20), default='opencv')  # opencv, yolov8
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Visual signals
    product_count = db.Column(db.Integer, default=0)
    empty_slot_count = db.Column(db.Integer, default=0)
    misplaced_count = db.Column(db.Integer, default=0)
    shelf_count = db.Column(db.Integer, default=0)
    shelf_occupancy = db.Column(db.Float, default=0)
    shelf_density_std = db.Column(db.Float, default=0)
    shelf_balance_index = db.Column(db.Float, default=0)

    # KPI values
    kpi_shelf_occupancy = db.Column(db.Float, default=0)
    kpi_empty_severity = db.Column(db.Float, default=0)
    kpi_shelf_imbalance = db.Column(db.Float, default=0)
    kpi_misplacement_rate = db.Column(db.Float, default=0)
    kpi_product_density = db.Column(db.Float, default=0)
    kpi_sell_through = db.Column(db.Float, default=0)
    kpi_stockout_prob = db.Column(db.Float, default=0)
    kpi_revenue_at_risk = db.Column(db.Float, default=0)
    kpi_planogram_compliance = db.Column(db.Float, default=0)

    # Risk prediction
    risk_level = db.Column(db.String(10), default='Low')
    risk_level_int = db.Column(db.Integer, default=0)
    risk_prob_low = db.Column(db.Float, default=0)
    risk_prob_medium = db.Column(db.Float, default=0)
    risk_prob_high = db.Column(db.Float, default=0)
    model_confidence = db.Column(db.Float, default=0)

    # Feature importance (JSON string)
    feature_importance_json = db.Column(db.Text, nullable=True)

    # Counts
    alert_count = db.Column(db.Integer, default=0)
    recommendation_count = db.Column(db.Integer, default=0)

    def to_dict(self):
        import json
        return {
            'id': self.id,
            'analysis_id': self.analysis_id,
            'user_id': self.user_id,
            'store_id': self.store_id,
            'store_name': self.store.store_name if self.store else None,
            'filename': self.filename,
            'detection_mode': self.detection_mode,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'visual_signals': {
                'product_count': self.product_count,
                'empty_slot_count': self.empty_slot_count,
                'misplaced_count': self.misplaced_count,
                'shelf_count': self.shelf_count,
                'shelf_occupancy': self.shelf_occupancy,
            },
            'kpis': {
                'shelf_occupancy': self.kpi_shelf_occupancy,
                'empty_severity': self.kpi_empty_severity,
                'shelf_imbalance': self.kpi_shelf_imbalance,
                'misplacement_rate': self.kpi_misplacement_rate,
                'product_density': self.kpi_product_density,
                'sell_through': self.kpi_sell_through,
                'stockout_prob': self.kpi_stockout_prob,
                'revenue_at_risk': self.kpi_revenue_at_risk,
                'planogram_compliance': self.kpi_planogram_compliance,
            },
            'risk': {
                'level': self.risk_level,
                'level_int': self.risk_level_int,
                'prob_low': self.risk_prob_low,
                'prob_medium': self.risk_prob_medium,
                'prob_high': self.risk_prob_high,
                'model_confidence': self.model_confidence,
            },
            'feature_importance': json.loads(self.feature_importance_json) if self.feature_importance_json else [],
            'alert_count': self.alert_count,
            'recommendation_count': self.recommendation_count,
        }

    @staticmethod
    def from_result(analysis_id, result, user_id=None, store_id=None, filename=None, detection_mode='opencv'):
        """Create an Analysis record from an analysis result dict."""
        import json
        signals = result.get('detection', {}).get('visual_signals', {})
        summary = result.get('detection', {}).get('summary', {})
        kpis = result.get('kpi_analysis', {}).get('kpis', {})
        risk = result.get('kpi_analysis', {}).get('risk_prediction', {})
        alerts = result.get('kpi_analysis', {}).get('alerts', [])
        recs = result.get('kpi_analysis', {}).get('recommendations', [])

        return Analysis(
            analysis_id=analysis_id,
            user_id=user_id,
            store_id=store_id,
            filename=filename,
            detection_mode=detection_mode,
            product_count=summary.get('total_products', 0),
            empty_slot_count=summary.get('empty_slots', 0),
            misplaced_count=summary.get('misplaced_items', 0),
            shelf_count=summary.get('shelf_regions', 0),
            shelf_occupancy=signals.get('shelf_occupancy', 0),
            shelf_density_std=signals.get('shelf_density_std', 0),
            shelf_balance_index=signals.get('shelf_balance_index', 0),
            kpi_shelf_occupancy=kpis.get('shelf_occupancy', {}).get('value', 0),
            kpi_empty_severity=kpis.get('empty_slot_severity', {}).get('value', 0),
            kpi_shelf_imbalance=kpis.get('shelf_imbalance', {}).get('value', 0),
            kpi_misplacement_rate=kpis.get('misplacement_rate', {}).get('value', 0),
            kpi_product_density=kpis.get('product_density', {}).get('value', 0),
            kpi_sell_through=kpis.get('sell_through_rate', {}).get('value', 0),
            kpi_stockout_prob=kpis.get('stockout_probability', {}).get('value', 0),
            kpi_revenue_at_risk=kpis.get('revenue_at_risk', {}).get('value', 0),
            kpi_planogram_compliance=kpis.get('planogram_compliance', {}).get('value', 0),
            risk_level=risk.get('overall_risk', 'Low'),
            risk_level_int=risk.get('risk_level', 0),
            risk_prob_low=risk.get('probabilities', {}).get('low', 0),
            risk_prob_medium=risk.get('probabilities', {}).get('medium', 0),
            risk_prob_high=risk.get('probabilities', {}).get('high', 0),
            model_confidence=risk.get('model_info', {}).get('confidence', 0),
            feature_importance_json=json.dumps(risk.get('feature_importance', [])),
            alert_count=len(alerts),
            recommendation_count=len(recs),
        )


class AuditLog(db.Model):
    __tablename__ = 'audit_logs'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    action = db.Column(db.String(50), nullable=False)  # login, upload, predict, admin_action
    details = db.Column(db.Text, nullable=True)
    ip_address = db.Column(db.String(50), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'username': self.user.username if self.user else 'anonymous',
            'action': self.action,
            'details': self.details,
            'ip_address': self.ip_address,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }

    @staticmethod
    def log(action, details=None, user_id=None, ip_address=None):
        """Create an audit log entry."""
        entry = AuditLog(
            user_id=user_id,
            action=action,
            details=details,
            ip_address=ip_address,
        )
        db.session.add(entry)
        try:
            db.session.commit()
        except Exception:
            db.session.rollback()
