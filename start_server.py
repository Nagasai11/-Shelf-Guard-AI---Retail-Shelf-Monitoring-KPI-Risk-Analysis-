"""
ShelfGuard AI - Production Server Launcher
Serves both the Flask API and built React frontend from port 5000.
Share the URL with your team!
"""
import os
import sys
import socket

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))
os.chdir(os.path.join(os.path.dirname(__file__), 'backend'))


def get_local_ip():
    """Get the local network IP address."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "localhost"


if __name__ == '__main__':
    local_ip = get_local_ip()
    port = 5000

    print()
    print("=" * 60)
    print("  ShelfGuard AI - Production Server")
    print("=" * 60)
    print()
    print("  Share these URLs with your team:")
    print()
    print(f"  ► Local:   http://localhost:{port}")
    print(f"  ► Network: http://{local_ip}:{port}")
    print()
    print("  Anyone on your WiFi/LAN can access the network URL!")
    print()
    print("  For internet access, use ngrok:")
    print(f"    ngrok http {port}")
    print()
    print("=" * 60)
    print()

    from app import app
    app.run(host='0.0.0.0', port=port, debug=False)
