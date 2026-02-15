
// Auto-detect API base URL logic extracted for testing
export const getApiBase = () => {
    // 1. Explicit override via Environment Variable (e.g. for local dev against remote API)
    if (process.env.REACT_APP_API_URL) {
        return process.env.REACT_APP_API_URL;
    }

    // 2. Local Development (npm start)
    // In development, localhost/127.0.0.1 should call backend directly regardless of dev port.
    // In production (Docker), use relative /api via nginx to avoid CORS.
    const host = window.location.hostname;
    const isLocalHost = host === 'localhost' || host === '127.0.0.1';
    const isLocalDev = process.env.NODE_ENV === 'development' && isLocalHost;
    if (isLocalDev) {
        const apiPort = process.env.REACT_APP_API_PORT || '18888';
        return `http://localhost:${apiPort}`;
    }

    // 3. Production / Docker / Network Access
    // In all other cases (Docker, IP access, Reverse Proxy), use relative path.
    // This lets Nginx handle the routing to /web/api or /api without CORS issues.
    return '';
};
