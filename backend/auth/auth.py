"""
JWT Authentication Module
Handles user registration, login, logout, and route protection.
STRICT MODE: No demo/public access. All routes require authentication.
"""

import os
import jwt
import bcrypt
from datetime import datetime, timedelta
from functools import wraps
from flask import Blueprint, request, jsonify, current_app
from models.database import db, User, AuditLog

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')

SECRET_KEY = os.environ.get('JWT_SECRET', 'shelfguard-ai-secret-key-change-in-production')
TOKEN_EXPIRY_HOURS = 24


def generate_token(user):
    """Generate a JWT token for a user."""
    payload = {
        'user_id': user.id,
        'username': user.username,
        'role': user.role,
        'exp': datetime.utcnow() + timedelta(hours=TOKEN_EXPIRY_HOURS),
        'iat': datetime.utcnow(),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm='HS256')


def decode_token(token):
    """Decode and verify a JWT token."""
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def token_required(f):
    """Decorator to protect routes with JWT authentication. STRICT — no bypass."""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        auth_header = request.headers.get('Authorization', '')
        if auth_header.startswith('Bearer '):
            token = auth_header[7:]

        if not token:
            return jsonify({'error': 'Authentication required. Please sign in.', 'code': 'AUTH_REQUIRED'}), 401

        payload = decode_token(token)
        if not payload:
            return jsonify({'error': 'Session expired. Please sign in again.', 'code': 'TOKEN_INVALID'}), 401

        user = User.query.get(payload['user_id'])
        if not user or not user.is_active:
            return jsonify({'error': 'User not found or deactivated.', 'code': 'USER_INVALID'}), 401

        request.current_user = user
        return f(*args, **kwargs)
    return decorated


def admin_required(f):
    """Decorator to restrict routes to admin users only. STRICT — no bypass."""
    @wraps(f)
    @token_required
    def decorated(*args, **kwargs):
        if not request.current_user or request.current_user.role != 'admin':
            return jsonify({'error': 'Admin access required. Your role does not have permission.'}), 403
        return f(*args, **kwargs)
    return decorated


# ---- Auth Routes ----

@auth_bp.route('/register', methods=['POST'])
def register():
    """Register a new user."""
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    username = data.get('username', '').strip()
    email = data.get('email', '').strip()
    password = data.get('password', '')
    role = data.get('role', 'manager')

    if not username or not email or not password:
        return jsonify({'error': 'Username, email, and password are required'}), 400

    if len(password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters'}), 400

    if role not in ('admin', 'manager'):
        role = 'manager'

    if User.query.filter_by(username=username).first():
        return jsonify({'error': 'Username already exists'}), 409

    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'Email already exists'}), 409

    password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    user = User(username=username, email=email, password_hash=password_hash, role=role)
    db.session.add(user)
    db.session.commit()

    AuditLog.log('register', f'User {username} registered with role {role}',
                 user_id=user.id, ip_address=request.remote_addr)

    token = generate_token(user)
    return jsonify({
        'message': 'Registration successful',
        'token': token,
        'user': user.to_dict(),
    }), 201


@auth_bp.route('/login', methods=['POST'])
def login():
    """Login with username/email and password."""
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400

    identifier = data.get('username', '').strip() or data.get('email', '').strip()
    password = data.get('password', '')

    if not identifier or not password:
        return jsonify({'error': 'Username/email and password are required'}), 400

    user = User.query.filter(
        (User.username == identifier) | (User.email == identifier)
    ).first()

    if not user:
        AuditLog.log('login_failed', f'Failed login attempt for {identifier}',
                     ip_address=request.remote_addr)
        return jsonify({'error': 'Invalid credentials'}), 401

    if not bcrypt.checkpw(password.encode('utf-8'), user.password_hash.encode('utf-8')):
        AuditLog.log('login_failed', f'Failed login attempt for {identifier}',
                     ip_address=request.remote_addr)
        return jsonify({'error': 'Invalid credentials'}), 401

    if not user.is_active:
        return jsonify({'error': 'Account is deactivated'}), 403

    user.last_login = datetime.utcnow()
    db.session.commit()

    AuditLog.log('login', f'User {user.username} logged in',
                 user_id=user.id, ip_address=request.remote_addr)

    token = generate_token(user)
    return jsonify({
        'message': 'Login successful',
        'token': token,
        'user': user.to_dict(),
    })


@auth_bp.route('/me', methods=['GET'])
@token_required
def get_current_user():
    """Get the current authenticated user."""
    return jsonify({'user': request.current_user.to_dict()})


@auth_bp.route('/logout', methods=['POST'])
@token_required
def logout():
    """Logout (client-side token removal, server-side audit log)."""
    AuditLog.log('logout', f'User {request.current_user.username} logged out',
                 user_id=request.current_user.id, ip_address=request.remote_addr)
    return jsonify({'message': 'Logged out successfully'})
