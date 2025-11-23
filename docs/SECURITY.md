# Security Documentation

## Security Features

### Authentication

1. **Password Hashing**
   - Uses bcrypt with automatic salt generation
   - Passwords are never stored in plain text
   - Default cost factor provides strong security

2. **Session Management**
   - HTTP-only cookies prevent XSS attacks
   - Secure flag enabled when HTTPS is configured
   - SameSite=Lax prevents CSRF attacks
   - Session expiration enforced (1 hour default, 30 days with "Remember Me")
   - Session IDs are cryptographically random (32 bytes, URL-safe)

3. **Rate Limiting**
   - Prevents brute force attacks
   - Default: 5 failed attempts per 5 minutes per IP/username
   - Configurable via environment variables
   - Failed attempts are tracked and cleared on successful login

4. **Password Requirements**
   - Minimum 8 characters
   - Maximum 128 characters (prevents DoS)
   - Must be different from current password
   - Current password verification required

### Authorization

1. **Route Protection**
   - All rule management endpoints require authentication
   - Authentication checked via dependency injection
   - Returns 401 Unauthorized if not authenticated

2. **Session Validation**
   - Sessions are validated on every request
   - Expired sessions are automatically removed
   - Invalid session IDs are rejected

### Input Validation

1. **Password Input**
   - Length validation (8-128 characters)
   - Prevents SQL injection (using parameterized queries via Pydantic)
   - Prevents XSS (passwords not displayed in UI)

2. **Username Input**
   - Validated against stored credentials
   - No special character restrictions (but no SQL injection risk)

### Security Headers

1. **Cookies**
   - `HttpOnly`: Prevents JavaScript access
   - `Secure`: Enabled when HTTPS is configured
   - `SameSite=Lax`: Prevents CSRF attacks

2. **CORS**
   - Currently allows all origins (configure for production)
   - Credentials allowed (required for cookies)

## Known Security Considerations

### Current Limitations

1. **Session Storage**
   - Sessions stored in-memory (lost on restart)
   - For production with multiple instances, use Redis
   - No session persistence across restarts

2. **Rate Limiting**
   - In-memory storage (lost on restart)
   - Per-IP/username basis (can be bypassed with multiple IPs)
   - For production, consider distributed rate limiting (Redis)

3. **HTTPS**
   - Secure cookie flag disabled by default
   - Set `APP_USE_HTTPS=true` when using HTTPS
   - Consider reverse proxy (nginx) for SSL termination

4. **Information Disclosure**
   - Error messages are generic (good)
   - No stack traces exposed (good)
   - Consider logging failed attempts for monitoring

5. **Password Complexity**
   - Only length requirement (8+ characters)
   - No complexity requirements (uppercase, lowercase, numbers, symbols)
   - Consider adding complexity requirements for production

### Recommendations for Production

1. **Enable HTTPS**
   ```bash
   APP_USE_HTTPS=true
   ```

2. **Use Redis for Sessions**
   - Replace in-memory session storage with Redis
   - Enables session persistence and multi-instance support

3. **Configure CORS Properly**
   - Restrict `allow_origins` to your domain
   - Remove wildcard `*` in production

4. **Add Password Complexity**
   - Require uppercase, lowercase, numbers, symbols
   - Consider using a password strength meter

5. **Implement Logging**
   - Log failed login attempts
   - Log password changes
   - Monitor for suspicious activity

6. **Add Account Lockout**
   - Lock account after N failed attempts
   - Require admin unlock or time-based unlock

7. **Use Environment Variables**
   - Never commit `.env` files
   - Use secrets management in production

8. **Password Recovery Security**
   - No password reset scripts in repository (security risk)
   - Manual recovery requires server access (documented in README)
   - Ensure proper access controls on server

9. **Regular Updates**
   - Keep dependencies updated
   - Monitor security advisories

## Security Testing

Run the security test script to verify security measures:

```bash
python scripts/security_test.py
```

The script tests:
- Authentication bypass attempts
- Login security
- Session management
- Password security
- Rate limiting
- Information disclosure
- CSRF protection
- Input validation

## Reporting Security Issues

If you discover a security vulnerability, please:
1. Do not open a public issue
2. Contact the maintainers privately
3. Provide detailed information about the vulnerability
4. Allow time for a fix before public disclosure

## Security Checklist

- [x] Password hashing (bcrypt)
- [x] HTTP-only cookies
- [x] Secure cookie flag (configurable)
- [x] SameSite cookie attribute
- [x] Session expiration
- [x] Rate limiting
- [x] Input validation
- [x] Route protection
- [x] Password requirements
- [ ] HTTPS enforcement (configurable)
- [ ] Redis session storage (recommended)
- [ ] Password complexity requirements (recommended)
- [ ] Account lockout (recommended)
- [ ] Security logging (recommended)
- [ ] CORS restrictions (recommended)

