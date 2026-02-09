import axios from "axios";

import { getApiBase } from "./urlHelper";

const API_BASE = getApiBase();

// Log API base URL for debugging (remove in production)
if (process.env.NODE_ENV === 'development') {
  console.log('API Base URL:', API_BASE);
  console.log('Frontend URL:', window.location.origin);
  console.log('Hostname:', window.location.hostname);
}

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Include cookies in requests
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Enhanced error logging in development
    if (process.env.NODE_ENV === 'development') {
      console.error('API Error:', {
        message: error.message,
        code: error.code,
        status: error.response?.status,
        url: error.config?.url,
        baseURL: error.config?.baseURL,
        fullURL: error.config?.baseURL + error.config?.url,
      });
    }

    // Handle authentication errors
    if (error.response?.status === 401) {
      // Check if it's a web auth error (not Synology auth)
      const errorDetail = error.response?.data?.detail;
      if (errorDetail && typeof errorDetail === 'object' && errorDetail.error === 'authentication_required') {
        // Web UI authentication required - trigger logout
        // Dispatch custom event for auth context to handle
        window.dispatchEvent(new CustomEvent('auth:logout'));
      }
    }
    return Promise.reject(error);
  }
);

// API methods
export const rulesAPI = {
  getAll: () => api.get('/rules'),
  getById: (id) => api.get(`/rules/${id}`),
  create: (data) => api.post('/rules', data),
  update: (id, data) => api.put(`/rules/${id}`, data),
  delete: (id) => api.delete(`/rules/${id}`),
  bulkDelete: (ids) => api.post('/rules/bulk-delete', ids),
  export: () => api.get('/rules/export'),
  import: (rules) => api.post('/rules/import', { rules }),
  validate: (data, excludeId = null) => {
    const url = excludeId ? `/rules/validate?exclude_rule_id=${excludeId}` : '/rules/validate';
    return api.post(url, data);
  },
};

export const authAPI = {
  firstLogin: (otpCode) => api.post('/auth/first-login', { otp_code: otpCode || null }),
  login: (username, password, rememberMe = false) =>
    api.post('/auth/login', { username, password, remember_me: rememberMe }),
  logout: () => api.post('/auth/logout'),
  checkAuth: () => api.get('/auth/me'),
  changePassword: (currentPassword, newPassword) =>
    api.post('/auth/change-password', { current_password: currentPassword, new_password: newPassword }),
};

export default api;
export { API_BASE };

