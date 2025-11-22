import axios from "axios";

// Auto-detect API base URL
const getApiBase = () => {
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;
  
  const isDomainAccess = hostname.includes('.') && 
                         hostname !== 'localhost' && 
                         !/^\d+\.\d+\.\d+\.\d+$/.test(hostname);
  
  if (isDomainAccess) {
    return `${protocol}//${hostname}/api`;
  }
  
  const port = process.env.REACT_APP_API_PORT || (hostname === 'localhost' ? '8000' : '18888');
  return `${protocol}//${hostname === 'localhost' ? 'localhost' : hostname}:${port}`;
};

const API_BASE = getApiBase();

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
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
    // Handle common errors
    if (error.response?.status === 401) {
      // Authentication error - handled by components
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
};

export default api;
export { API_BASE };

