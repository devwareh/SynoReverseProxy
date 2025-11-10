# Docker Deployment Guide

This guide explains how to deploy the Synology Reverse Proxy Manager using Docker and Docker Compose.

## Prerequisites

- Docker Engine 20.10+ or Docker Desktop
- Docker Compose 2.0+
- Access to your Synology NAS
- Synology NAS credentials

## Quick Start

1. **Clone the repository** (if not already done):

   ```bash
   git clone <repository-url>
   cd SynoReverseProxy
   ```

2. **Set environment variables** in `docker-compose.yml` or via Portainer:

   - `SYNOLOGY_NAS_URL` - Your NAS URL (e.g., `http://YOUR_NAS_IP:5000`)
   - `SYNOLOGY_USERNAME` - Your DSM username
   - `SYNOLOGY_PASSWORD` - Your DSM password
   - `SYNOLOGY_OTP_CODE` - OTP code (optional, only needed for first login)

3. **Build and start the containers**:

   ```bash
   docker-compose up -d
   ```

4. **Access the application**:
   - Frontend UI: `http://your-nas-ip:18889`
   - Backend API: `http://your-nas-ip:18888`
   - API Docs: `http://your-nas-ip:18888/docs`

## Port Configuration

The application uses uncommon ports to avoid conflicts with common NAS services:

- **Backend API**: Port `18888`
- **Frontend UI**: Port `18889`

You can change these ports in `docker-compose.yml` if needed.

## Environment Variables

### Required Variables

| Variable            | Description           | Example                   |
| ------------------- | --------------------- | ------------------------- |
| `SYNOLOGY_NAS_URL`  | Your Synology NAS URL | `http://YOUR_NAS_IP:5000` |
| `SYNOLOGY_USERNAME` | DSM username          | `admin`                   |
| `SYNOLOGY_PASSWORD` | DSM password          | `your_password`           |

### Optional Variables

| Variable                       | Description                     | Default           |
| ------------------------------ | ------------------------------- | ----------------- |
| `SYNOLOGY_OTP_CODE`            | 2FA OTP code (first login only) | -                 |
| `SYNOLOGY_DEVICE_NAME`         | Device identifier               | Hostname          |
| `SYNOLOGY_SESSION_EXPIRY_SECS` | Session expiry in seconds       | `518400` (6 days) |

**Note on OTP**: The `SYNOLOGY_OTP_CODE` environment variable is optional and only needed if you want to perform first login during container startup. For a better experience, especially with 2FA codes that expire quickly, use the `/auth/first-login` API endpoint instead (see [First Login Setup](#first-login-setup) below).

## Deployment Methods

### Method 1: Docker Compose (Recommended)

1. Edit `docker-compose.yml` and set environment variables:

   ```yaml
   environment:
     - SYNOLOGY_NAS_URL=http://YOUR_NAS_IP:5000
     - SYNOLOGY_USERNAME=your_username
     - SYNOLOGY_PASSWORD=your_password
   ```

2. Build and start:

   ```bash
   docker-compose up -d --build
   ```

3. View logs:

   ```bash
   docker-compose logs -f
   ```

4. Stop services:
   ```bash
   docker-compose down
   ```

### Method 2: Portainer

Portainer is a popular Docker management UI for NAS devices. Here's how to deploy using Portainer:

1. **Create a Stack**:

   - Go to Portainer → Stacks → Add Stack
   - Name: `syno-reverse-proxy`
   - Build method: Upload or paste `docker-compose.yml`

2. **Set Environment Variables**:

   - In the Stack editor, scroll to "Environment variables"
   - Add the required variables:
     - `SYNOLOGY_NAS_URL`
     - `SYNOLOGY_USERNAME`
     - `SYNOLOGY_PASSWORD`
     - `SYNOLOGY_OTP_CODE` (optional)

3. **Deploy the Stack**:

   - Click "Deploy the stack"
   - Portainer will build and start the containers

4. **Access the Application**:
   - Frontend: `http://your-nas-ip:18889`
   - Backend: `http://your-nas-ip:18888`

### Method 3: Synology Container Manager

1. **Create a Project**:

   - Open Container Manager
   - Go to Project → Create
   - Name: `syno-reverse-proxy`
   - Source: Upload `docker-compose.yml`

2. **Configure Environment Variables**:

   - In the project settings, add environment variables
   - Set all required variables

3. **Deploy**:
   - Click "Create" to build and start containers

## Volume Mounts

The application uses two persistent volumes:

- `./data` → `/app/data` - Stores session data and encryption keys
- `./logs` → `/app/logs` - Stores application logs

These volumes persist data across container restarts.

## Network Configuration

- Both services are on the same Docker network (`syno-network`)
- Frontend connects to backend using service name: `http://backend:18888`
- External access via host ports `18888` (backend) and `18889` (frontend)

## Health Checks

Both containers include health checks:

- **Backend**: Checks `http://localhost:18888/` every 30 seconds
- **Frontend**: Checks `http://localhost:18889/` every 30 seconds

## First Login Setup

After deploying the application, you need to perform an initial authentication to establish a device token. This is a **one-time setup** that allows future logins without requiring OTP codes.

### Why Use the First-Login Endpoint?

- **OTP codes expire quickly** (30-60 seconds), making it difficult to set them in environment variables before they expire
- **Not all users have 2FA enabled** - the endpoint handles both scenarios gracefully
- **No container restart needed** - you can call the endpoint after deployment
- **Better error messages** - clear feedback on whether 2FA is required

### How to Use

1. **Deploy without OTP**:

   - Set only the required environment variables: `SYNOLOGY_NAS_URL`, `SYNOLOGY_USERNAME`, `SYNOLOGY_PASSWORD`
   - Do **not** set `SYNOLOGY_OTP_CODE` (or leave it empty)

2. **Call the first-login endpoint** (choose the easiest method for you):

   **Option 1: Using the Interactive API Docs (Easiest - Recommended)**

   This is the simplest method - no command line needed!

   1. Open your browser and go to: `http://your-nas-ip:18888/docs`
   2. Scroll down to find the `/auth/first-login` endpoint
   3. Click on it to expand, then click the **"Try it out"** button
   4. In the request body, enter:
      - For 2FA users: `{"otp_code": "123456"}` (replace with your current OTP)
      - For non-2FA users: `{}` (empty JSON object)
   5. Click the **"Execute"** button
   6. Check the response - you should see `"success": true` if it worked

   **Option 2: Using curl (Command Line)**

   Only use this if you prefer command line tools:

   **For users with 2FA enabled:**

   ```bash
   curl -X POST http://your-nas-ip:18888/auth/first-login \
     -H "Content-Type: application/json" \
     -d '{"otp_code": "123456"}'
   ```

   **For users without 2FA:**

   ```bash
   curl -X POST http://your-nas-ip:18888/auth/first-login \
     -H "Content-Type: application/json" \
     -d '{}'
   ```

3. **Verify success**:

   - You should receive a response like:
     ```json
     {
       "success": true,
       "message": "First login successful. Device token saved.",
       "device_token_saved": true,
       "requires_otp": false
     }
     ```

4. **Device token saved**:
   - After successful first login, the device token is saved in the `data` volume
   - Future logins will use the device token automatically
   - No OTP needed for subsequent operations

### Error Responses

**2FA Required (no OTP provided):**

```json
{
  "success": false,
  "error": "2FA authentication required",
  "message": "Please provide OTP code. Your account has 2FA enabled.",
  "requires_otp": true
}
```

**Invalid OTP:**

```json
{
  "success": false,
  "error": "Invalid OTP code",
  "message": "The provided OTP code is incorrect or expired. Please generate a new OTP code and try again.",
  "requires_otp": true
}
```

**Invalid Credentials:**

```json
{
  "success": false,
  "error": "Invalid credentials",
  "message": "Username or password is incorrect. Please check your credentials.",
  "requires_otp": false
}
```

### Alternative: Using Environment Variable

If you prefer to set OTP via environment variable (not recommended due to expiration):

1. Set `SYNOLOGY_OTP_CODE` in your `docker-compose.yml` or Portainer
2. Deploy the stack
3. The first login will happen automatically on startup
4. You can remove `SYNOLOGY_OTP_CODE` after the first successful deployment

## Troubleshooting

### Containers won't start

1. **Check logs**:

   ```bash
   docker-compose logs backend
   docker-compose logs frontend
   ```

2. **Verify environment variables**:

   ```bash
   docker-compose config
   ```

3. **Check port conflicts**:
   ```bash
   netstat -tuln | grep -E '18888|18889'
   ```

### Backend authentication errors

- Verify `SYNOLOGY_NAS_URL` is correct
- Check username and password
- For first login, use the `/auth/first-login` endpoint (see [First Login Setup](#first-login-setup)) instead of setting `SYNOLOGY_OTP_CODE`
- If you see "No valid session or device token found", call `/auth/first-login` first
- Check backend logs: `docker-compose logs backend`

### Frontend can't connect to backend

- Verify both containers are running: `docker-compose ps`
- Check network connectivity: `docker-compose exec frontend ping backend`
- Verify backend is accessible: `curl http://localhost:18888/`

### Port conflicts

If ports 18888 or 18889 are already in use:

1. Edit `docker-compose.yml`
2. Change port mappings:
   ```yaml
   ports:
     - "NEW_PORT:18888" # Backend
     - "NEW_PORT:18889" # Frontend
   ```
3. Rebuild: `docker-compose up -d --build`

### Permission errors

If you see permission errors with volumes:

```bash
sudo chown -R $USER:$USER data/ logs/
```

## Updating the Application

1. **Pull latest changes**:

   ```bash
   git pull
   ```

2. **Rebuild and restart**:
   ```bash
   docker-compose up -d --build
   ```

## Security Considerations

- **Never commit** `docker-compose.yml` with real credentials
- Use Portainer secrets or environment variable files for production
- Keep Docker and images updated
- Use strong passwords for Synology DSM
- Enable 2FA on your Synology NAS

## Production Recommendations

1. **Use environment variable files**:

   ```yaml
   env_file:
     - .env.production
   ```

2. **Set restart policies**:

   ```yaml
   restart: always
   ```

3. **Enable resource limits**:

   ```yaml
   deploy:
     resources:
       limits:
         cpus: "1"
         memory: 512M
   ```

4. **Use Docker secrets** for sensitive data (Portainer supports this)

## Maintenance

### View logs

```bash
docker-compose logs -f [service_name]
```

### Restart a service

```bash
docker-compose restart [service_name]
```

### Stop all services

```bash
docker-compose down
```

### Remove volumes (⚠️ deletes data)

```bash
docker-compose down -v
```

## Support

For issues or questions:

1. Check the logs: `docker-compose logs`
2. Verify environment variables are set correctly
3. Ensure ports are not in use
4. Check Docker and Docker Compose versions
