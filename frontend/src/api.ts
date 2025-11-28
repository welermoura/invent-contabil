import axios from 'axios';

// Dynamic Base URL Strategy
// 1. Try env var (VITE_API_URL)
// 2. Try constructing from window location (for LAN access without config)
// 3. Fallback to localhost
let baseURL = import.meta.env.VITE_API_URL;

if (!baseURL) {
    if (typeof window !== 'undefined') {
        const protocol = window.location.protocol;
        const hostname = window.location.hostname;
        // Backend port is fixed at 8001 externally
        baseURL = `${protocol}//${hostname}:8001`;
    } else {
        baseURL = 'http://localhost:8001';
    }
}

console.log(`[API] Connecting to Backend at: ${baseURL}`);

const api = axios.create({
    baseURL: baseURL,
});

api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

export default api;
