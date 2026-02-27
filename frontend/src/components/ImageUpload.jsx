import { useState, useCallback } from 'react';
import { Upload, Image, X, Loader2, Camera } from 'lucide-react';
import './ImageUpload.css';

export default function ImageUpload({ onAnalyze, isLoading }) {
    const [dragActive, setDragActive] = useState(false);
    const [preview, setPreview] = useState(null);
    const [selectedFile, setSelectedFile] = useState(null);

    const handleDrag = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    }, []);

    const processFile = useCallback((file) => {
        if (!file) return;
        const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/bmp'];
        if (!validTypes.includes(file.type)) {
            alert('Please upload a valid image file (JPG, PNG, WebP, BMP)');
            return;
        }

        setSelectedFile(file);
        const reader = new FileReader();
        reader.onload = (e) => setPreview(e.target.result);
        reader.readAsDataURL(file);
    }, []);

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            processFile(e.dataTransfer.files[0]);
        }
    }, [processFile]);

    const handleFileInput = useCallback((e) => {
        if (e.target.files && e.target.files[0]) {
            processFile(e.target.files[0]);
        }
    }, [processFile]);

    const handleAnalyze = () => {
        if (selectedFile && onAnalyze) {
            onAnalyze(selectedFile);
        }
    };

    const clearFile = () => {
        setPreview(null);
        setSelectedFile(null);
    };

    return (
        <div className="upload-container animate-fade-in">
            <div className="upload-header">
                <div className="upload-icon-wrapper">
                    <Camera size={24} />
                </div>
                <div>
                    <h2>Shelf Image Analysis</h2>
                    <p>Upload a retail shelf image to detect products & analyze KPIs</p>
                </div>
            </div>

            {!preview ? (
                <div
                    className={`dropzone ${dragActive ? 'dropzone-active' : ''}`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => document.getElementById('file-input').click()}
                    id="dropzone"
                >
                    <input
                        type="file"
                        id="file-input"
                        accept="image/*"
                        onChange={handleFileInput}
                        style={{ display: 'none' }}
                    />
                    <div className="dropzone-content">
                        <div className="dropzone-icon">
                            <Upload size={36} strokeWidth={1.5} />
                        </div>
                        <h3>Drop shelf image here</h3>
                        <p>or click to browse files</p>
                        <div className="dropzone-formats">
                            <span>JPG</span>
                            <span>PNG</span>
                            <span>WebP</span>
                            <span>BMP</span>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="preview-container">
                    <div className="preview-image-wrapper">
                        <img src={preview} alt="Shelf preview" className="preview-image" />
                        <button className="preview-remove" onClick={clearFile} title="Remove image" id="remove-image-btn">
                            <X size={16} />
                        </button>
                    </div>
                    <div className="preview-info">
                        <div className="preview-file-info">
                            <Image size={16} />
                            <span>{selectedFile?.name}</span>
                            <span className="preview-file-size">
                                {(selectedFile?.size / 1024).toFixed(1)} KB
                            </span>
                        </div>
                        <button
                            className="analyze-btn"
                            onClick={handleAnalyze}
                            disabled={isLoading}
                            id="analyze-btn"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 size={18} className="spin-icon" />
                                    Analyzing...
                                </>
                            ) : (
                                <>
                                    <Camera size={18} />
                                    Analyze Shelf
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
