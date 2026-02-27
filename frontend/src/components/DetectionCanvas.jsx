import { useState } from 'react';
import { ZoomIn, ZoomOut, Layers, Eye, EyeOff, Box } from 'lucide-react';
import './DetectionCanvas.css';

export default function DetectionCanvas({ detection }) {
    const [showProducts, setShowProducts] = useState(true);
    const [showEmpty, setShowEmpty] = useState(true);
    const [showMisplaced, setShowMisplaced] = useState(true);
    const [zoom, setZoom] = useState(1);
    const [selectedItem, setSelectedItem] = useState(null);

    if (!detection) return null;

    const { annotated_image, detections, summary } = detection;

    const handleZoomIn = () => setZoom((z) => Math.min(z + 0.25, 3));
    const handleZoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.5));

    return (
        <div className="detection-container animate-fade-in">
            <div className="detection-header">
                <div className="detection-title">
                    <Box size={20} />
                    <h3>Object Detection Results</h3>
                </div>

                <div className="detection-controls">
                    <div className="toggle-group">
                        <button
                            className={`toggle-btn ${showProducts ? 'active' : ''}`}
                            onClick={() => setShowProducts(!showProducts)}
                            title="Toggle products"
                            id="toggle-products-btn"
                        >
                            {showProducts ? <Eye size={14} /> : <EyeOff size={14} />}
                            <span>Products ({summary.total_products})</span>
                        </button>
                        <button
                            className={`toggle-btn empty ${showEmpty ? 'active' : ''}`}
                            onClick={() => setShowEmpty(!showEmpty)}
                            title="Toggle empty slots"
                            id="toggle-empty-btn"
                        >
                            {showEmpty ? <Eye size={14} /> : <EyeOff size={14} />}
                            <span>Empty ({summary.empty_slots})</span>
                        </button>
                        <button
                            className={`toggle-btn misplaced ${showMisplaced ? 'active' : ''}`}
                            onClick={() => setShowMisplaced(!showMisplaced)}
                            title="Toggle misplaced"
                            id="toggle-misplaced-btn"
                        >
                            {showMisplaced ? <Eye size={14} /> : <EyeOff size={14} />}
                            <span>Misplaced ({summary.misplaced_items})</span>
                        </button>
                    </div>

                    <div className="zoom-controls">
                        <button onClick={handleZoomOut} className="zoom-btn" id="zoom-out-btn">
                            <ZoomOut size={14} />
                        </button>
                        <span className="zoom-label">{(zoom * 100).toFixed(0)}%</span>
                        <button onClick={handleZoomIn} className="zoom-btn" id="zoom-in-btn">
                            <ZoomIn size={14} />
                        </button>
                    </div>
                </div>
            </div>

            <div className="detection-viewport">
                <div
                    className="detection-image-container"
                    style={{ transform: `scale(${zoom})` }}
                >
                    <img
                        src={`data:image/jpeg;base64,${annotated_image}`}
                        alt="Detected shelf"
                        className="detection-image"
                        id="detection-result-image"
                    />

                    {/* Overlay bounding boxes */}
                    {showProducts && detections.products.map((product, idx) => (
                        <div
                            key={`p-${idx}`}
                            className={`bbox-overlay product ${selectedItem === `p-${idx}` ? 'selected' : ''}`}
                            style={{
                                left: `${(product.bbox[0] / detection.image_dimensions.width) * 100}%`,
                                top: `${(product.bbox[1] / detection.image_dimensions.height) * 100}%`,
                                width: `${(product.bbox[2] / detection.image_dimensions.width) * 100}%`,
                                height: `${(product.bbox[3] / detection.image_dimensions.height) * 100}%`,
                            }}
                            onClick={() => setSelectedItem(selectedItem === `p-${idx}` ? null : `p-${idx}`)}
                        >
                            {selectedItem === `p-${idx}` && (
                                <div className="bbox-tooltip">
                                    <strong>{product.category}</strong>
                                    <span>Confidence: {(product.confidence * 100).toFixed(0)}%</span>
                                    <span>Shelf: {product.shelf_id + 1}</span>
                                </div>
                            )}
                        </div>
                    ))}

                    {showEmpty && detections.empty_slots.map((slot, idx) => (
                        <div
                            key={`e-${idx}`}
                            className={`bbox-overlay empty ${slot.severity}`}
                            style={{
                                left: `${(slot.bbox[0] / detection.image_dimensions.width) * 100}%`,
                                top: `${(slot.bbox[1] / detection.image_dimensions.height) * 100}%`,
                                width: `${(slot.bbox[2] / detection.image_dimensions.width) * 100}%`,
                                height: `${(slot.bbox[3] / detection.image_dimensions.height) * 100}%`,
                            }}
                        >
                            <span className="empty-label">{slot.severity.toUpperCase()}</span>
                        </div>
                    ))}

                    {showMisplaced && detections.misplaced_items.map((item, idx) => (
                        <div
                            key={`m-${idx}`}
                            className="bbox-overlay misplaced"
                            style={{
                                left: `${(item.bbox[0] / detection.image_dimensions.width) * 100}%`,
                                top: `${(item.bbox[1] / detection.image_dimensions.height) * 100}%`,
                                width: `${(item.bbox[2] / detection.image_dimensions.width) * 100}%`,
                                height: `${(item.bbox[3] / detection.image_dimensions.height) * 100}%`,
                            }}
                        >
                            <span className="misplaced-label">MISPLACED</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Detection Summary Stats */}
            <div className="detection-stats">
                <div className="stat-chip products">
                    <Layers size={14} />
                    <span>{summary.total_products} Products</span>
                </div>
                <div className="stat-chip empty">
                    <span className="stat-dot"></span>
                    <span>{summary.empty_slots} Empty Slots</span>
                </div>
                <div className="stat-chip misplaced">
                    <span className="stat-dot"></span>
                    <span>{summary.misplaced_items} Misplaced</span>
                </div>
                <div className="stat-chip shelves">
                    <span className="stat-dot"></span>
                    <span>{summary.shelf_regions} Shelves</span>
                </div>
                <div className="stat-chip model">
                    <span>{summary.model_used}</span>
                </div>
            </div>
        </div>
    );
}
