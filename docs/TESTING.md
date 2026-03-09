# Testing Guide

This guide helps you test the Synology Reverse Proxy Manager locally using Docker.

## Prerequisites

1. **Docker and Docker Compose** installed and running
2. **Synology NAS credentials**:
   - NAS URL (e.g., `http://192.168.1.100:5000`)
   - Username
   - Password
   - OTP code (if 2FA is enabled)

## Quick Start

### Option 1: Using the Test Script (Recommended)

1. **Set environment variables** (or create a `.env` file):

   ```bash
   export SYNOLOGY_NAS_URL='http://YOUR_NAS_IP:5000'
   export SYNOLOGY_USERNAME='your_username'
   export SYNOLOGY_PASSWORD='your_password'
   ```

2. **Run the test script**:

   ```bash
   ./scripts/test-docker.sh
   ```

3. **Access the application** (using default ports):
   - Frontend: http://localhost:8889 (or custom port if `FRONTEND_PORT` is set)
   - Backend API: http://localhost:18888 (or custom port if `BACKEND_PORT` is set)
   - API Docs: http://localhost:18888/docs (or custom port)

### Option 2: Manual Docker Compose

1. **Set environment variables**:

   ```bash
   export SYNOLOGY_NAS_URL='http://YOUR_NAS_IP:5000'
   export SYNOLOGY_USERNAME='your_username'
   export SYNOLOGY_PASSWORD='your_password'
   ```

2. **Build and start**:

   ```bash
   docker-compose up -d --build
   ```

3. **Check status**:
   ```bash
   docker-compose ps
   docker-compose logs -f
   ```

## Testing First-Login Functionality

### Test 1: Automatic UI Modal (Easiest)

1. Open http://localhost:8889 in your browser (or custom port if `FRONTEND_PORT` is set)
2. The app will try to load rules
3. If authentication is needed, a **"First-Time Setup Required"** modal should appear automatically
4. Enter your OTP code (if 2FA enabled) or leave empty
5. Click "Authenticate"
6. You should see a success message and rules should load

### Test 2: API Docs Method

1. Open http://localhost:18888/docs in your browser (or custom port if `BACKEND_PORT` is set)
2. Find the `/auth/first-login` endpoint
3. Click "Try it out"
4. Enter your OTP code: `{"otp_code": "123456"}` or `{}` for non-2FA
5. Click "Execute"
6. Check the response - should show `"success": true`

### Test 3: curl Command

```bash
# For 2FA users
curl -X POST http://localhost:18888/auth/first-login \
  -H "Content-Type: application/json" \
  -d '{"otp_code": "123456"}'

# For non-2FA users
curl -X POST http://localhost:18888/auth/first-login \
  -H "Content-Type: application/json" \
  -d '{}'
```

## Testing Scenarios

### Scenario 1: First-Time Setup (No Device Token)

1. **Clean start** (remove existing session):

   ```bash
   rm -rf data/syno_session.json.enc
   docker-compose restart backend
   ```

2. **Access frontend**: http://localhost:8889 (or custom port if `FRONTEND_PORT` is set)
3. **Expected**: Modal should appear asking for first-login
4. **Action**: Enter OTP (if 2FA) or leave empty
5. **Expected**: Success message, rules load

### Scenario 2: 2FA User (OTP Required)

1. **Call first-login without OTP**:

   ```bash
   curl -X POST http://localhost:18888/auth/first-login \
     -H "Content-Type: application/json" \
     -d '{}'
   ```

   (Replace `18888` with your custom `BACKEND_PORT` if set)

2. **Expected**: Error message saying "2FA authentication required"

3. **Call with OTP**:

   ```bash
   curl -X POST http://localhost:18888/auth/first-login \
     -H "Content-Type: application/json" \
     -d '{"otp_code": "123456"}'
   ```

   (Replace `18888` with your custom `BACKEND_PORT` if set)

4. **Expected**: Success message with device token saved

### Scenario 3: Non-2FA User

1. **Call first-login without OTP**:

   ```bash
   curl -X POST http://localhost:18888/auth/first-login \
     -H "Content-Type: application/json" \
     -d '{}'
   ```

   (Replace `18888` with your custom `BACKEND_PORT` if set)

2. **Expected**: Success message (no OTP needed)

### Scenario 4: Invalid Credentials

1. **Set wrong password** in environment variables
2. **Call first-login**
3. **Expected**: Error message "Invalid credentials"

### Scenario 5: Already Authenticated

1. **After successful first-login**, device token is saved
2. **Restart containers**: `docker-compose restart`
3. **Access frontend**: http://localhost:8889 (or custom port if `FRONTEND_PORT` is set)
4. **Expected**: Rules load immediately, no modal appears

### Scenario 6: Run backend tests without clobbering your NAS session

By default, both the running backend and the test suite share the same Synology
session file at `data/syno_session.json.enc`. If you run tests against the same
`data/` directory that your dev instance uses, this will force a NAS
re-authentication the next time you open the UI.

To keep test runs isolated, point pytest at a separate session file.
First make sure the directory exists:

```bash
mkdir -p data/test
```

Then run:

```bash
SYNOLOGY_NAS_URL=http://localhost:5000 \
SYNOLOGY_USERNAME=test \
SYNOLOGY_PASSWORD=test \
SYNO_SESSION_FILE=data/test/syno_session.json.enc \
conda run -n synoenv bash -lc 'pytest tests/ -v'
```

This uses a test-only `data/test/syno_session.json.enc` and avoids touching the
session used by your normal dev or Docker environment.

## Docker usage modes

There are two main ways to run the app with Docker:

1. **Use published images from GHCR (fast sanity check)**  
   This is the default behavior of `docker-compose.yml`:

   ```bash
   docker-compose up -d
   ```

   This pulls and runs `ghcr.io/devwareh/syno-reverse-proxy-backend:latest` and
   `ghcr.io/devwareh/syno-reverse-proxy-frontend:latest`. Use this when you want
   to quickly verify that a released version works against your NAS.

2. **Build images from local source (when developing)**  
   To test your local changes (backend or frontend) in Docker, use the build
   override file:

   ```bash
   docker-compose -f docker-compose.yml -f docker-compose.build.yml up -d --build
   ```

   This builds the backend and frontend images from the current working tree and
   starts containers with those images. Use this when iterating on features or
   fixes and you want Docker to reflect your local code instead of the last
   published images.


## Viewing Logs

```bash
# All logs
docker-compose logs -f

# Backend only
docker-compose logs -f backend

# Frontend only
docker-compose logs -f frontend

# Last 100 lines
docker-compose logs --tail=100
```

## Troubleshooting

### Containers won't start

```bash
# Check logs
docker-compose logs

# Check if ports are in use
lsof -i :18888
lsof -i :8889   # Frontend (or your FRONTEND_PORT)

# Rebuild from scratch
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Authentication errors

1. **Check environment variables**:

   ```bash
   docker-compose exec backend env | grep SYNOLOGY
   ```

2. **Check backend logs**:

   ```bash
   docker-compose logs backend | grep -i error
   ```

3. **Verify NAS is accessible**:
   ```bash
   curl http://YOUR_NAS_IP:5000
   ```

### Frontend can't connect to backend

1. **Check if backend is running**:

   ```bash
   curl http://localhost:18888/
   ```

2. **Check network**:

   ```bash
   docker-compose exec frontend ping backend
   ```

3. **Check frontend logs**:
   ```bash
   docker-compose logs frontend
   ```

### Modal not appearing

1. **Check browser console** for errors
2. **Check if authentication error is detected**:

   ```bash
   docker-compose logs backend | grep -i "first-login\|device token"
   ```

3. **Manually trigger** by accessing API directly:
   ```bash
   curl http://localhost:18888/rules  # (or custom BACKEND_PORT)
   ```

## Clean Up

```bash
# Stop containers
docker-compose down

# Stop and remove volumes (⚠️ deletes session data)
docker-compose down -v

# Remove images
docker-compose down --rmi all
```

## Next Steps After Testing

Once testing is complete:

1. **For NAS deployment**: Follow instructions in `docs/DOCKER.md`
2. **For production**: Set up proper environment variables and secrets
3. **For development**: Continue using local Docker or switch to local development mode
