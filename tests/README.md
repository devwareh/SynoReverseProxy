# Tests

This directory contains test scripts for the Synology Reverse Proxy Manager.

## Test Files

- **`test_session_persistence.py`** - Tests session persistence functionality including:

  - Session encryption and disk persistence
  - Session expiry cleanup
  - Password change session invalidation
  - Corrupted file handling

- **`test_login.py`** - Quick authentication test utility for debugging login issues.

## Running Tests

### Session Persistence Tests

```bash
# From project root
python3 tests/test_session_persistence.py

# Or make it executable and run directly
./tests/test_session_persistence.py
```

### Login Test

```bash
# Test with default credentials
python3 tests/test_login.py

# Test with custom password (password is not printed for security)
python3 tests/test_login.py your_password_here
```

## Security Notes

- Test scripts use test credentials only (e.g., "testuser", "testpassword123")
- Actual passwords are never printed in output
- Test scripts backup and restore existing session/auth files
- All sensitive files (`.enc`, `.key`, `.web_auth.json`) are already in `.gitignore`

## Test Environment

Tests automatically:

- Backup existing session/auth files before running
- Restore original files after completion
- Clean up test artifacts
- Use isolated test credentials

## Requirements

Tests require the backend dependencies to be installed:

```bash
pip install -r backend/requirements.txt
```

