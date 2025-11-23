# Pre-Commit Security Checklist

Before committing, ensure the following sensitive information is NOT included:

## Files to NEVER Commit

### ✅ Already in .gitignore (Safe)
- `config/.env` - Contains Synology credentials
- `config/.web_auth.json` - Contains password hashes (now added to .gitignore)
- `data/*` - Contains encrypted session files
- `*.key` - Encryption keys
- `*.enc` - Encrypted files
- `logs/*` - Log files

### ⚠️ Check These Files Before Committing

1. **Test Scripts** (OK to commit - they use default test credentials):
   - `scripts/security_test.py` - Uses `admin/admin123` (test credentials)
   - `scripts/test_login.py` - Test utility

**Note**: `reset_password.py` was removed for security reasons. Password recovery is documented in README.md.

2. **Documentation** (OK to commit - mentions defaults):
   - `README.md` - Mentions default `admin/admin` credentials (documentation)
   - `docs/SECURITY.md` - Security documentation
   - `docs/SECURITY_AUDIT.md` - Security audit report

3. **Code Files** (OK to commit - no hardcoded secrets):
   - All backend code - Uses environment variables
   - All frontend code - No hardcoded credentials
   - `docker-compose.yml` - Uses environment variables

## Information to Redact/Review

### ✅ Safe to Commit (No Changes Needed)
- Default credentials mentioned in docs (`admin/admin`) - This is intentional documentation
- Test credentials in test scripts (`admin123`) - These are test utilities
- Environment variable names (e.g., `APP_PASSWORD`) - Not actual values
- Code that handles passwords (hashing, verification) - No actual passwords

### ❌ Should NOT Be in Code
- Actual password values (none found)
- API keys or tokens (none found)
- Real IP addresses (uses `YOUR_NAS_IP` placeholder)
- Real usernames (uses `your_username` placeholder)

## Verification Steps

Before committing, run:

```bash
# Check for sensitive files
git status --ignored | grep -E "\.env|\.web_auth|\.key|\.enc"

# Verify .gitignore is working
git check-ignore config/.web_auth.json config/.env

# Check for hardcoded secrets (should return nothing)
grep -r "password.*=.*['\"].*[^=]" --include="*.py" --include="*.js" backend/ frontend/ | grep -v "test\|admin123\|admin/admin" | grep -v "password_hash\|password.*:" | head -20
```

## Summary

**Files Safe to Commit:**
- All code files (backend, frontend)
- Documentation files
- Test scripts (they use test credentials)
- Configuration templates

**Files Already Ignored (Safe):**
- `config/.env` ✅
- `config/.web_auth.json` ✅ (now added to .gitignore)
- `data/*` ✅
- `logs/*` ✅

**No Action Needed** - Your codebase is clean! All sensitive data is either:
1. In `.gitignore` (environment files, auth files)
2. Using placeholders (`YOUR_NAS_IP`, `your_username`)
3. Test credentials in test scripts (acceptable)

