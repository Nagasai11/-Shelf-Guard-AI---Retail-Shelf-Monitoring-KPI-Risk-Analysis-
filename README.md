# ShelfGuard AI — Retail Shelf Monitoring & KPI Risk Analysis

A full-stack application that transforms retail shelf images into actionable business insights using **computer vision**, **predictive analytics**, and **explainable AI**.

## Features

- 📸 **Image Upload** — Drag & drop shelf images for instant analysis
- 🎯 **Object Detection** — OpenCV-powered product detection with bounding boxes
- 📊 **KPI Dashboard** — 8 real-time metrics with color-coded risk indicators
- 🤖 **Risk Prediction** — Random Forest ML model with explainable feature importance
- ⚡ **Real-Time Alerts** — Critical warnings with actionable recommendations
- 💰 **Revenue Impact** — Estimated revenue at risk from shelf gaps

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite |
| Styling | CSS3 (dark theme + glassmorphism) |
| Charts | Recharts |
| Backend | Python Flask |
| Detection | OpenCV |
| ML | scikit-learn Random Forest |

## Quick Start

### Backend
```bash
cd backend
pip install -r requirements.txt
python app.py
```

### Frontend (Development)
```bash
cd frontend
npm install
npm run dev
```

### Production (Single Server)
```bash
cd frontend && npm run build && cd ..
python start_server.py
# App runs at http://localhost:5000
```

## Architecture

1. User uploads shelf image
2. Backend runs object detection (OpenCV)
3. Extracts visual signals (product count, empty slots, density)
4. Fuses signals with sales data → KPI metrics
5. Random Forest predicts risk → sends to frontend
6. Interactive dashboard with alerts and recommendations

## License

MIT
