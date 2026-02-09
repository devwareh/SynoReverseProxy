
import { getApiBase } from './urlHelper';

describe('getApiBase', () => {
    const originalEnv = process.env;
    const originalLocation = window.location;

    beforeEach(() => {
        jest.resetModules();
        process.env = { ...originalEnv };
        delete window.location;
        window.location = { ...originalLocation };
    });

    afterAll(() => {
        process.env = originalEnv;
        window.location = originalLocation;
    });

    test('should return REACT_APP_API_URL if set', () => {
        process.env.REACT_APP_API_URL = 'http://custom-api:8080';
        expect(getApiBase()).toBe('http://custom-api:8080');
    });

    test('should return local dev URL if on localhost:3000', () => {
        delete process.env.REACT_APP_API_URL;
        window.location = {
            hostname: 'localhost',
            port: '3000'
        };
        expect(getApiBase()).toBe('http://localhost:18888');
    });

    test('should use custom port for local dev URL if REACT_APP_API_PORT is set', () => {
        delete process.env.REACT_APP_API_URL;
        process.env.REACT_APP_API_PORT = '9999';
        window.location = {
            hostname: 'localhost',
            port: '3000'
        };
        expect(getApiBase()).toBe('http://localhost:9999');
    });

    test('should return empty string (relative path) for production/docker', () => {
        delete process.env.REACT_APP_API_URL;
        window.location = {
            hostname: 'my-nas-ip',
            port: '8889'
        };
        expect(getApiBase()).toBe('');
    });

    test('should return empty string for reverse proxy domain', () => {
        delete process.env.REACT_APP_API_URL;
        window.location = {
            hostname: 'rp.example.com',
            port: ''
        };
        expect(getApiBase()).toBe('');
    });
});
