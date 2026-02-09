
// Auto-detect API base URL logic extracted for testing
export const getApiBase = () => {
    // 1. Explicit override via Environment Variable (e.g. for local dev against remote API)
    if (process.env.REACT_APP_API_URL) {
        return process.env.REACT_APP_API_URL;
    }

    // 2. Local Development (npm start)
    // If running on localhost (any port), default to backend on port 18888
    if (window.location.hostname === 'localhost') {
        const apiPort = process.env.REACT_APP_API_PORT || '18888';
        return `http://localhost:${apiPort}`;
    }

    // 3. Production / Docker / Network Access
    // In all other cases (Docker, IP access, Reverse Proxy), use relative path.
    // This lets Nginx handle the routing to /web/api or /api without CORS issues.
    return '';
};
