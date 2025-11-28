import axios from 'axios';

// Log for debugging network issues
const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8001';
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
