import axios from 'axios';

// Dynamic Base URL Strategy
// 1. Check if we are running in browser
// 2. If configured URL is localhost but we are on a different IP, force usage of window.location
// 3. Otherwise use env var or fallback
// Use window.location.origin (current host) as default if no ENV provided.
// This assumes the frontend is served via NGINX on port 80/443 which proxies /api requests.
let baseURL = import.meta.env.VITE_API_URL || window.location.origin;

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

// Bulk Operations Types
export interface BulkWriteOffData {
    item_ids: number[];
    reason: string;
    justification?: string;
}

export interface BulkTransferData {
    item_ids: number[];
    target_branch_id: number;
    invoice_number?: string;
    invoice_series?: string;
    invoice_date?: string; // ISO string
}

// Requests Types
export interface RequestData {
    id: number;
    type: 'WRITE_OFF' | 'TRANSFER';
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    requester_id: number;
    category_id: number;
    current_step: number;
    created_at: string;
    updated_at?: string;
    requester?: any;
    category?: any;
    items?: any[];
    current_approvers?: string[];
    data?: any;
}

// Helper functions for bulk operations
export const bulkWriteOff = async (data: BulkWriteOffData) => {
    const response = await api.post('/items/bulk/write-off', data);
    return response.data;
};

export const bulkTransfer = async (data: BulkTransferData) => {
    const response = await api.post('/items/bulk/transfer', data);
    return response.data;
};

// Requests API
export const getMyRequests = async () => {
    const response = await api.get<RequestData[]>('/requests/my-requests');
    return response.data;
};

export const getPendingActions = async () => {
    const response = await api.get<any[]>('/items/pending-actions');
    return response.data;
};

export const getPendingRequests = async () => {
    const response = await api.get<RequestData[]>('/requests/pending');
    return response.data;
};

export const approveRequest = async (id: number) => {
    const response = await api.post<RequestData>(`/requests/${id}/approve`);
    return response.data;
};

export const rejectRequest = async (id: number) => {
    const response = await api.post<RequestData>(`/requests/${id}/reject`);
    return response.data;
};

// New entities: CostCenter and Sector (Generic API access is enough usually, but can type if needed)
// Using direct api.get/post in components for CRUD

export default api;
