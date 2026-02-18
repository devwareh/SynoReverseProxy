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
      const errorDetail = error.response?.data?.detail;
      // Only fire auth:logout for genuine web-session failures.
      // Condition requires the explicit error shape set by the web-auth layer
      // (errorDetail.error === 'authentication_required'), AND excludes NAS-auth
      // 401s that carry requires_first_login:true — those are handled by the OTP
      // probe in App.js and must not log the user out of the web UI.
      //
      // Contract note: requires_first_login is set on 401s from the rules API
      // (dependencies.py). The /auth/first-login endpoint currently returns 400
      // for 2FA errors and sets requires_otp — a separate field on a different
      // HTTP status code. If that contract changes, both paths need to be revisited.
      const isWebAuthRequired =
        errorDetail &&
        typeof errorDetail === 'object' &&
        errorDetail.error === 'authentication_required' &&
        errorDetail.requires_first_login !== true;

      if (isWebAuthRequired) {
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
  checkSetup: () => api.get('/auth/setup/check'),
  completeSetup: (data) => api.post('/auth/setup/complete', data),
  /**
   * Attempt NAS authentication.
   * @param {string|null} otpCode - 6-digit TOTP code, or null to probe without OTP.
   *   Pass null as a sentinel to detect whether 2FA is required without prompting
   *   the user first. The backend returns requires_otp:true if 2FA is enforced.
   */
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

