"""
Image Preprocessing Module
Handles resize, normalization, and enhancement for shelf images.
"""

import cv2
import numpy as np
from PIL import Image
import io


class ImagePreprocessor:
    """Standardizes input images before sending to detection/depth models."""

    TARGET_SIZE = (640, 640)  # Standard input size for both models

    @staticmethod
    def load_image(image_bytes):
        """Load image from bytes into OpenCV format."""
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError("Could not decode image. Check file format.")
        return img

    @staticmethod
    def resize(img, target_size=None):
        """Resize image while preserving aspect ratio, padding if needed."""
        if target_size is None:
            target_size = ImagePreprocessor.TARGET_SIZE

        h, w = img.shape[:2]
        scale = min(target_size[0] / w, target_size[1] / h)
        new_w, new_h = int(w * scale), int(h * scale)
        resized = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_LINEAR)

        # Pad to target size
        canvas = np.full((target_size[1], target_size[0], 3), 114, dtype=np.uint8)
        y_off = (target_size[1] - new_h) // 2
        x_off = (target_size[0] - new_w) // 2
        canvas[y_off:y_off + new_h, x_off:x_off + new_w] = resized

        return canvas, scale, (x_off, y_off)

    @staticmethod
    def normalize(img):
        """Normalize pixel values to [0, 1] range."""
        return img.astype(np.float32) / 255.0

    @staticmethod
    def enhance(img):
        """Apply CLAHE enhancement for better contrast."""
        lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        l_enhanced = clahe.apply(l)
        enhanced = cv2.merge([l_enhanced, a, b])
        return cv2.cvtColor(enhanced, cv2.COLOR_LAB2BGR)

    @staticmethod
    def denoise(img, strength=5):
        """Light denoising to reduce artifacts."""
        return cv2.fastNlMeansDenoisingColored(img, None, strength, strength, 7, 21)

    @staticmethod
    def preprocess_for_yolo(image_bytes):
        """Full preprocessing pipeline for YOLOv8."""
        img = ImagePreprocessor.load_image(image_bytes)
        original = img.copy()
        enhanced = ImagePreprocessor.enhance(img)
        resized, scale, offset = ImagePreprocessor.resize(enhanced)
        return {
            "original": original,
            "processed": resized,
            "enhanced": enhanced,
            "scale": scale,
            "offset": offset,
            "original_size": (original.shape[1], original.shape[0]),
        }

    @staticmethod
    def preprocess_for_depth(image_bytes):
        """Full preprocessing pipeline for Depth Anything V2."""
        img = ImagePreprocessor.load_image(image_bytes)
        original = img.copy()
        enhanced = ImagePreprocessor.enhance(img)
        # Depth model works best with 518x518 (Depth Anything V2 default)
        resized, scale, offset = ImagePreprocessor.resize(enhanced, (518, 518))
        return {
            "original": original,
            "processed": resized,
            "enhanced": enhanced,
            "scale": scale,
            "offset": offset,
            "original_size": (original.shape[1], original.shape[0]),
        }
