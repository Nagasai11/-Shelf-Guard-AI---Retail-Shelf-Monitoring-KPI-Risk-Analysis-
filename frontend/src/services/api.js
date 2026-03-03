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

// ---- Auth Token Management ----
let authToken = localStorage.getItem('shelfguard_token') || null;

export const setToken = (token) => {
    authToken = token;
    if (token) {
        localStorage.setItem('shelfguard_token', token);
    } else {
        localStorage.removeItem('shelfguard_token');
    }
};

export const getToken = () => authToken;

// Add auth header to all requests
api.interceptors.request.use((config) => {
    if (authToken) {
        config.headers.Authorization = `Bearer ${authToken}`;
    }
    return config;
});

// ---- Auth Endpoints ----
export const loginUser = async (credentials) => {
    const response = await api.post('/auth/login', credentials);
    if (response.data.token) {
        setToken(response.data.token);
    }
    return response.data;
};

export const registerUser = async (userData) => {
    const response = await api.post('/auth/register', userData);
    if (response.data.token) {
        setToken(response.data.token);
    }
    return response.data;
};

export const logoutUser = async () => {
    try {
        await api.post('/auth/logout');
    } catch { /* ignore */ }
    setToken(null);
};

export const getCurrentUser = async () => {
    const response = await api.get('/auth/me');
    return response.data;
};

// ---- Analysis Endpoints ----
export const analyzeShelfImage = async (imageFile, detectionMode = 'opencv', storeId = null) => {
    const formData = new FormData();
    formData.append('image', imageFile);
    formData.append('detection_mode', detectionMode);
    if (storeId) formData.append('store_id', storeId);

    const response = await api.post('/analyze', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
};

export const getHealth = async () => {
    const response = await api.get('/health');
    return response.data;
};

export const getHistory = async (params = {}) => {
    const response = await api.get('/history', { params });
    return response.data;
};

export const exportCSV = async (params = {}) => {
    const response = await api.get('/history/export', { params, responseType: 'text' });
    return response.data;
};

export const explainRisk = async (features) => {
    const response = await api.post('/kpi/explain', { features });
    return response.data;
};

// ---- Store Endpoints ----
export const getStores = async () => {
    const response = await api.get('/stores');
    return response.data;
};

export const createStore = async (storeData) => {
    const response = await api.post('/stores', storeData);
    return response.data;
};

export const compareStores = async () => {
    const response = await api.get('/stores/compare');
    return response.data;
};

// ---- Admin Endpoints ----
export const getAdminAnalytics = async () => {
    const response = await api.get('/admin/analytics');
    return response.data;
};

export const getAuditLogs = async (params = {}) => {
    const response = await api.get('/admin/audit-logs', { params });
    return response.data;
};

export default api;
