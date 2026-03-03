"""
Logging Middleware — Structured request/response logging and error handling.
"""

import time
import logging
from flask import request, g
from datetime import datetime

# Configure structured logger
logger = logging.getLogger('shelfguard')
logger.setLevel(logging.INFO)

if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter(
        '[%(asctime)s] %(levelname)s %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    ))
    logger.addHandler(handler)


def init_logging(app):
    """Initialize request/response logging middleware."""

    @app.before_request
    def log_request():
        g.start_time = time.time()
        if request.path.startswith('/api/'):
            logger.info(f"→ {request.method} {request.path} | IP: {request.remote_addr}")

    @app.after_request
    def log_response(response):
        if request.path.startswith('/api/'):
            duration = round((time.time() - g.get('start_time', time.time())) * 1000, 1)
            logger.info(
                f"← {request.method} {request.path} | "
                f"Status: {response.status_code} | "
                f"Duration: {duration}ms"
            )
        return response

    @app.errorhandler(500)
    def handle_500(error):
        logger.error(f"500 Error: {error} | Path: {request.path}")
        return {'error': 'Internal server error', 'details': str(error)}, 500

    @app.errorhandler(404)
    def handle_404(error):
        if request.path.startswith('/api/'):
            return {'error': f'Endpoint not found: {request.path}'}, 404
        # Let frontend handle non-API 404s
        return error
