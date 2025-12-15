import axios from 'axios';

// Dynamic Base URL Strategy
// 1. Check if we are running in browser
// 2. If configured URL is localhost but we are on a different IP, force usage of window.location
// 3. Otherwise use env var or fallback
let baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8001';

if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    // If user is accessing via IP/Network (not localhost) AND config points to localhost
    // We override it to use the current hostname (assuming backend is on same host port 8001)
    if (hostname !== 'localhost' && hostname !== '127.0.0.1' && baseURL.includes('localhost')) {
        const protocol = window.location.protocol;
        baseURL = `${protocol}//${hostname}:8001`;
        console.log('[API] Detected LAN access, overriding localhost API URL to:', baseURL);
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

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            // Token expired or invalid, logout user
            localStorage.removeItem('token');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default api;
