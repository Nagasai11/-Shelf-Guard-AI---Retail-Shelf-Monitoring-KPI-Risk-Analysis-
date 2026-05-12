"""
Depth Anything V2 Pipeline
Depth estimation, rear empty space analysis, false fullness detection.
Uses real Depth Anything V2 if installed, otherwise falls back to
gradient-based depth approximation using OpenCV.
"""

import cv2
import numpy as np
import base64

# Try importing Depth Anything V2 (transformers + torch)
try:
    import torch
    from transformers import pipeline as hf_pipeline
    DEPTH_MODEL_AVAILABLE = True
except ImportError:
    DEPTH_MODEL_AVAILABLE = False


class DepthAnythingPipeline:
    """
    Model 2: Depth Anything V2 pipeline.
    Analyzes shelf depth to detect rear empty spaces that front products hide.

    Key insight: YOLOv8 sees the FRONT of the shelf.
    Depth Anything V2 sees the DEPTH — revealing hollow/false fullness.
    """

    def __init__(self):
        self.model = None
        self.is_real_model = False
        if DEPTH_MODEL_AVAILABLE:
            try:
                self.model = hf_pipeline(
                    "depth-estimation",
                    model="depth-anything/Depth-Anything-V2-Small-hf",
                    device="cpu"
                )
                self.is_real_model = True
            except Exception:
                self.is_real_model = False

    def run(self, image_bytes):
        """
        Run depth estimation pipeline on shelf image.
        Returns depth map, hollow shelf analysis, rear empty metrics.
        """
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError("Could not decode image")

        h, w = img.shape[:2]

        # Get depth map
        if self.is_real_model:
            depth_map = self._estimate_depth_real(img)
        else:
            depth_map = self._estimate_depth_opencv(img)

        # Normalize depth map to 0-255
        depth_normalized = self._normalize_depth(depth_map)

        # Analyze shelf depth zones
        shelf_regions = self._detect_shelf_zones(img)
        depth_analysis = self._analyze_shelf_depth(depth_normalized, shelf_regions, h, w)

        # Detect hollow/false fullness regions
        hollow_regions = self._detect_hollow_regions(depth_normalized, shelf_regions)

        # Compute depth-based metrics
        metrics = self._compute_depth_metrics(depth_normalized, depth_analysis, hollow_regions, h, w)

        # Generate depth heatmap visualization
        heatmap = self._generate_depth_heatmap(depth_normalized, img)
        _, hm_buf = cv2.imencode('.jpg', heatmap, [cv2.IMWRITE_JPEG_QUALITY, 85])
        heatmap_b64 = base64.b64encode(hm_buf).decode('utf-8')

        # Generate hollow shelf overlay
        hollow_vis = self._draw_hollow_overlay(img.copy(), hollow_regions)
        _, hv_buf = cv2.imencode('.jpg', hollow_vis, [cv2.IMWRITE_JPEG_QUALITY, 85])
        hollow_b64 = base64.b64encode(hv_buf).decode('utf-8')

        return {
            "model_name": "Depth-Anything-V2" if self.is_real_model else "Depth-OpenCV-Approximation",
            "model_type": "depth_estimation",
            "is_real_model": self.is_real_model,
            "image_size": {"width": w, "height": h},
            "depth_heatmap": heatmap_b64,
            "hollow_overlay": hollow_b64,
            "depth_analysis": depth_analysis,
            "hollow_regions": [self._format_hollow(r) for r in hollow_regions],
            "summary": {
                "avg_depth": round(float(np.mean(depth_normalized)), 1),
                "depth_variance": round(float(np.std(depth_normalized)), 1),
                "hollow_region_count": len(hollow_regions),
                "shelf_count": len(shelf_regions),
            },
            "kpi_metrics": metrics,
        }

    # ---- Depth Estimation ----

    def _estimate_depth_real(self, img):
        """Use Depth Anything V2 model for real depth estimation."""
        from PIL import Image
        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        pil_img = Image.fromarray(img_rgb)
        result = self.model(pil_img)
        depth = np.array(result["depth"])
        # Resize to original image size
        depth = cv2.resize(depth, (img.shape[1], img.shape[0]))
        return depth.astype(np.float32)

    def _estimate_depth_opencv(self, img):
        """
        OpenCV-based depth approximation when Depth Anything V2 is unavailable.
        Uses multiple visual cues: gradients, texture, brightness.
        """
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.float32)
        h, w = gray.shape

        # Cue 1: Texture complexity (high texture = close objects)
        laplacian = np.abs(cv2.Laplacian(gray, cv2.CV_32F))
        texture = cv2.GaussianBlur(laplacian, (21, 21), 0)
        texture = texture / (np.max(texture) + 1e-6)

        # Cue 2: Edge density (more edges = more products = closer)
        edges = cv2.Canny(gray.astype(np.uint8), 50, 150).astype(np.float32)
        edge_density = cv2.GaussianBlur(edges, (31, 31), 0)
        edge_density = edge_density / (np.max(edge_density) + 1e-6)

        # Cue 3: Brightness variation (uniform = empty depth, varied = products)
        local_mean = cv2.GaussianBlur(gray, (51, 51), 0)
        local_var = cv2.GaussianBlur((gray - local_mean) ** 2, (51, 51), 0)
        brightness_var = np.sqrt(local_var)
        brightness_var = brightness_var / (np.max(brightness_var) + 1e-6)

        # Cue 4: Color saturation (products tend to be more colorful)
        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV).astype(np.float32)
        saturation = hsv[:, :, 1] / 255.0
        sat_blurred = cv2.GaussianBlur(saturation, (21, 21), 0)

        # Combine cues: high values = close (products), low values = far (empty depth)
        depth_map = (
            texture * 0.30 +
            edge_density * 0.25 +
            brightness_var * 0.25 +
            sat_blurred * 0.20
        )

        # Invert: in our convention, HIGH depth value = FAR (empty rear space)
        depth_map = 1.0 - depth_map
        depth_map = depth_map * 255

        return depth_map

    def _normalize_depth(self, depth_map):
        """Normalize depth map to 0-255 uint8."""
        dmin, dmax = np.min(depth_map), np.max(depth_map)
        if dmax - dmin < 1e-6:
            return np.full_like(depth_map, 128, dtype=np.uint8)
        normalized = ((depth_map - dmin) / (dmax - dmin) * 255).astype(np.uint8)
        return normalized

    # ---- Shelf Zone Analysis ----

    def _detect_shelf_zones(self, img):
        """Detect shelf zones (same as YOLOv8 pipeline for consistency)."""
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        h, w = gray.shape
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        edges = cv2.Canny(blurred, 30, 100)
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (w // 3, 1))
        horizontal = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, kernel)

        row_sums = np.sum(horizontal, axis=1)
        threshold = np.max(row_sums) * 0.3 if np.max(row_sums) > 0 else 0

        positions = []
        in_line = False
        start = 0
        for i in range(len(row_sums)):
            if row_sums[i] > threshold and not in_line:
                in_line = True
                start = i
            elif row_sums[i] <= threshold and in_line:
                in_line = False
                positions.append((start + i) // 2)

        if len(positions) < 2:
            import random
            ns = random.randint(3, 5)
            sh = h // (ns + 1)
            positions = [sh * (i + 1) for i in range(ns)]

        shelves = []
        positions = sorted(positions)
        prev = 0
        for pos in positions:
            if pos - prev > h * 0.05:
                shelves.append({"x": 0, "y": prev, "width": w, "height": pos - prev, "id": len(shelves)})
            prev = pos
        if h - prev > h * 0.05:
            shelves.append({"x": 0, "y": prev, "width": w, "height": h - prev, "id": len(shelves)})

        return shelves if shelves else [{"x": 0, "y": 0, "width": w, "height": h, "id": 0}]

    def _analyze_shelf_depth(self, depth_map, shelves, h, w):
        """Analyze depth within each shelf zone."""
        analysis = []
        for shelf in shelves:
            sy, sx = shelf["y"], shelf["x"]
            sh, sw = shelf["height"], shelf["width"]
            roi = depth_map[sy:sy+sh, sx:sx+sw]

            if roi.size == 0:
                continue

            avg_depth = float(np.mean(roi))
            depth_std = float(np.std(roi))

            # Split into front and rear halves
            mid = sw // 2
            front_depth = float(np.mean(roi[:, :mid])) if mid > 0 else avg_depth
            rear_depth = float(np.mean(roi[:, mid:])) if mid > 0 else avg_depth

            # High rear depth suggests empty space behind products
            rear_empty_indicator = max(0, rear_depth - front_depth) / 255.0

            analysis.append({
                "shelf_id": shelf["id"],
                "avg_depth": round(avg_depth, 1),
                "depth_std": round(depth_std, 1),
                "front_depth": round(front_depth, 1),
                "rear_depth": round(rear_depth, 1),
                "rear_empty_indicator": round(rear_empty_indicator, 3),
            })

        return analysis

    # ---- Hollow/False Fullness Detection ----

    def _detect_hollow_regions(self, depth_map, shelves):
        """
        Detect regions where front shelf appears full but depth analysis
        reveals empty space behind (false fullness / hollow shelves).
        """
        hollow = []
        h, w = depth_map.shape

        for shelf in shelves:
            sy, sx = shelf["y"], shelf["x"]
            sh, sw = shelf["height"], shelf["width"]
            roi = depth_map[sy:sy+sh, sx:sx+sw]

            if roi.size == 0:
                continue

            avg = float(np.mean(roi))
            std = float(np.std(roi))

            # Scan horizontal blocks for depth anomalies
            block_w = max(sw // 6, 30)
            for bx in range(0, sw - block_w, block_w // 2):
                block = roi[:, bx:bx+block_w]
                block_avg = float(np.mean(block))

                # Regions significantly deeper than shelf average → hollow
                if block_avg > avg + std * 0.8 and block_avg > 140:
                    hollow_score = min(1.0, (block_avg - avg) / (std + 1e-6) * 0.3)
                    hollow.append({
                        "bbox": [sx + bx, sy + 5, block_w, sh - 10],
                        "shelf_id": shelf["id"],
                        "hollow_score": round(hollow_score, 3),
                        "depth_value": round(block_avg, 1),
                        "severity": "high" if hollow_score > 0.6 else "medium" if hollow_score > 0.3 else "low",
                    })

        return hollow

    # ---- Depth Metrics ----

    def _compute_depth_metrics(self, depth_map, depth_analysis, hollow_regions, h, w):
        """Compute depth-based KPI metrics."""
        avg_depth = float(np.mean(depth_map))
        depth_std = float(np.std(depth_map))

        # Rear empty ratio: average rear_empty_indicator across all shelves
        rear_indicators = [d["rear_empty_indicator"] for d in depth_analysis]
        rear_empty_ratio = float(np.mean(rear_indicators)) if rear_indicators else 0

        # Hollow shelf score: weighted average of hollow region severity
        if hollow_regions:
            severity_w = {"high": 1.0, "medium": 0.6, "low": 0.3}
            hollow_scores = [r["hollow_score"] * severity_w.get(r["severity"], 0.5) for r in hollow_regions]
            hollow_shelf_score = min(1.0, float(np.mean(hollow_scores)))
        else:
            hollow_shelf_score = 0

        # Depth occupancy: inverse of how "deep" (empty) the shelves look
        depth_occupancy = max(0, 1.0 - (avg_depth / 255.0))

        # Depth uniformity: how consistent is depth across the image
        depth_uniformity = max(0, 1.0 - (depth_std / 128.0))

        return {
            "rear_empty_ratio": round(rear_empty_ratio, 3),
            "hollow_shelf_score": round(hollow_shelf_score, 3),
            "depth_occupancy_score": round(depth_occupancy, 3),
            "depth_uniformity": round(depth_uniformity, 3),
            "avg_depth_value": round(avg_depth, 1),
            "depth_variance": round(depth_std, 1),
            "false_fullness_risk": round(min(1.0, rear_empty_ratio * 0.6 + hollow_shelf_score * 0.4), 3),
        }

    # ---- Visualization ----

    def _generate_depth_heatmap(self, depth_map, original_img):
        """Generate a color heatmap from the depth map overlaid on original image."""
        colored = cv2.applyColorMap(depth_map, cv2.COLORMAP_INFERNO)
        blended = cv2.addWeighted(original_img, 0.3, colored, 0.7, 0)

        # Add legend
        h = blended.shape[0]
        cv2.putText(blended, "NEAR", (10, h - 40), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 1)
        cv2.putText(blended, "FAR", (10, h - 15), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 100, 100), 1)

        return blended

    def _draw_hollow_overlay(self, img, hollow_regions):
        """Draw hollow/false-fullness regions on the image."""
        overlay = img.copy()
        for r in hollow_regions:
            x, y, bw, bh = r["bbox"]
            if r["severity"] == "high":
                color = (0, 0, 255)
            elif r["severity"] == "medium":
                color = (0, 140, 255)
            else:
                color = (0, 200, 200)

            cv2.rectangle(overlay, (x, y), (x + bw, y + bh), color, -1)
            label = f"HOLLOW {r['hollow_score']:.0%}"
            cv2.putText(img, label, (x + 4, y + bh // 2),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 255), 1)

        result = cv2.addWeighted(img, 0.6, overlay, 0.4, 0)
        return result

    def _format_hollow(self, r):
        return {
            "bbox": r["bbox"],
            "hollow_score": r["hollow_score"],
            "severity": r["severity"],
            "depth_value": r["depth_value"],
        }
