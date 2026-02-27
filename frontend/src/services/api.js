import axios from 'axios';

// In production (served from Flask), use relative URL
// In development, proxy to Flask backend
const API_BASE = import.meta.env.DEV
    ? 'http://localhost:5000/api'
    : '/api';

const api = axios.create({
    baseURL: API_BASE,
    timeout: 60000,
});

export const analyzeShelfImage = async (imageFile) => {
    const formData = new FormData();
    formData.append('image', imageFile);

    const response = await api.post('/analyze', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
};

export const getHealth = async () => {
    const response = await api.get('/health');
    return response.data;
};

export const getHistory = async () => {
    const response = await api.get('/history');
    return response.data;
};

export const explainRisk = async (features) => {
    const response = await api.post('/kpi/explain', { features });
    return response.data;
};

export default api;
