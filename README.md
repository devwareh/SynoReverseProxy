# Synology Reverse Proxy Manager

A modern web application for managing reverse proxy rules on Synology NAS devices. Features secure authentication with device tokens, CSRF protection, and a beautiful, responsive UI with full CRUD operations.

## Features

- 🔐 **Secure Authentication**: API v6 with device tokens (OTP only needed once)
- 🛡️ **CSRF Protection**: SynoToken integration for all API calls
- 🎨 **Modern UI**: Beautiful, responsive design with smooth animations
- ✨ **Full CRUD**: Create, Read, Update, and Delete reverse proxy rules
- 🔍 **Search & Filter**: Quickly find rules by description or FQDN
- 📱 **Responsive**: Works on desktop, tablet, and mobile devices
- ⚡ **Real-time Updates**: Automatic refresh after operations

## Prerequisites

- Python 3.8+
- Node.js 14+ and npm
- Synology NAS with DSM 6.0+
- Network access to your Synology NAS

## Installation

### 1. Clone the repository

```bash
git clone <repository-url>
cd SynoReverseProxy
```

### 2. Backend Setup

This project uses a conda environment called `synoenv`. If you don't have it yet, create it:

```bash
# Create conda environment (if it doesn't exist)
conda create -n synoenv python=3.10 -y
conda activate synoenv

# Install Python dependencies
pip install -r backend/requirements.txt
```

**Create .env file:**

```bash
# Copy the example file
cp config/.env.example config/.env

# Edit config/.env with your actual credentials
# Required variables:
# - SYNOLOGY_NAS_URL
# - SYNOLOGY_USERNAME
# - SYNOLOGY_PASSWORD
# - SYNOLOGY_OTP_CODE (optional, only needed for first login)
```

**Important**:

- `SYNOLOGY_OTP_CODE` is only needed for the first login. After that, a device token will be stored and OTP won't be required for subsequent logins.
- **Password is always required** - the device token only eliminates the need for OTP, not the password.
- Never commit your `.env` file to version control (it's in `.gitignore`).

### 3. Frontend Setup

```bash
cd frontend
npm install
```

## Usage

### Quick Start (Recommended)

Use the provided startup script to run both backend and frontend:

```bash
./scripts/start.sh
```

This script will:

- Check prerequisites (conda, Node.js, npm)
- Verify `.env` file exists
- Activate the `synoenv` conda environment
- Install/update Python dependencies
- Install/update Node dependencies
- Start both backend and frontend servers
- Display server URLs and PIDs

To stop the servers, press `Ctrl+C` or run:

```bash
./scripts/stop.sh
```

### Manual Start

#### Start the Backend

```bash
# From project root
# Activate conda environment
conda activate synoenv

# Install dependencies (first time only)
pip install -r backend/requirements.txt

# Start server (from backend directory)
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`

#### Start the Frontend

```bash
# From frontend directory
cd frontend

# Install dependencies (first time only)
npm install

# Start development server
HOST=0.0.0.0 npm start
```

The UI will be available at `http://localhost:3000`

## Docker Deployment (Recommended for NAS)

For production deployment on your NAS, Docker is the recommended method. This provides better isolation, easier updates, and works seamlessly with Portainer and Synology Container Manager.

### Quick Start with Docker

1. **Set environment variables** in `docker-compose.yml`:
   ```yaml
   environment:
     - SYNOLOGY_NAS_URL=http://YOUR_NAS_IP:5000
     - SYNOLOGY_USERNAME=your_username
     - SYNOLOGY_PASSWORD=your_password
   ```

2. **Build and start**:
   ```bash
   docker-compose up -d --build
   ```

3. **Access the application** (using default ports):
   - Frontend UI: `http://your-nas-ip:8889` (or custom port if `FRONTEND_PORT` is set)
   - Backend API: `http://your-nas-ip:18888` (or custom port if `BACKEND_PORT` is set)
   - API Docs: `http://your-nas-ip:18888/docs` (or custom port)

### Portainer Deployment

1. Open Portainer → Stacks → Add Stack
2. Upload or paste `docker-compose.yml`
3. Set environment variables in Portainer's UI:
   - `SYNOLOGY_NAS_URL`
   - `SYNOLOGY_USERNAME`
   - `SYNOLOGY_PASSWORD`
   - `SYNOLOGY_OTP_CODE` (optional, first login only)
   - `FRONTEND_PORT` (optional, default: 8889)
   - `BACKEND_PORT` (optional, default: 18888)
4. Deploy the stack

### Port Configuration

Ports are configurable via environment variables:

- **Backend API**: Default port `18888` (configurable via `BACKEND_PORT` environment variable)
- **Frontend UI**: Default port `8889` (configurable via `FRONTEND_PORT` environment variable)

**To change ports**, set environment variables before running `docker-compose`:

```bash
export FRONTEND_PORT=3000
export BACKEND_PORT=8000
docker-compose up -d --build
```

Or set them in Portainer's environment variables section when deploying.

### Docker Commands

```bash
# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Rebuild after code changes
docker-compose up -d --build
```

For detailed Docker deployment instructions, see [docs/DOCKER.md](docs/DOCKER.md).

For testing instructions, see [docs/TESTING.md](docs/TESTING.md).

## API Endpoints

### Authentication
- `POST /auth/first-login` - Perform first-time authentication with optional OTP (see [First Login Setup](#first-login-setup))

### Rules Management
- `GET /rules` - List all reverse proxy rules
- `GET /rules/{rule_id}` - Get a single rule by ID
- `POST /rules` - Create a new rule
- `PUT /rules/{rule_id}` - Update an existing rule
- `DELETE /rules/{rule_id}` - Delete a rule
- `POST /rules/export` - Export all rules as JSON
- `POST /rules/import` - Import rules from JSON
- `POST /create` - Legacy endpoint (backward compatibility)

## Authentication Flow

### First Login Setup

After deploying the application (especially with Docker), you need to perform an initial authentication. This is a **one-time setup** that establishes a device token for future logins.

**Recommended Method: Use the `/auth/first-login` API endpoint**

This method is preferred because:
- OTP codes expire quickly (30-60 seconds), making environment variables impractical
- Works for both 2FA-enabled and non-2FA users
- No container restart needed
- Better error messages

**Option 1: Using the Interactive API Docs (Easiest - Recommended)**

No command line needed! Just use your browser:

1. Open `http://your-nas-ip:18888/docs` in your browser (or custom port if `BACKEND_PORT` is set)
2. Find the `/auth/first-login` endpoint
3. Click "Try it out"
4. Enter your OTP code (if 2FA enabled) or leave empty: `{"otp_code": "123456"}` or `{}`
5. Click "Execute"
6. Check the response for success

**Option 2: Using curl (Command Line)**

Only if you prefer command line:

**For users with 2FA enabled:**
```bash
curl -X POST http://your-nas-ip:18888/auth/first-login \
  -H "Content-Type: application/json" \
  -d '{"otp_code": "123456"}'
```
(Replace `18888` with your custom `BACKEND_PORT` if set)

**For users without 2FA:**
```bash
curl -X POST http://your-nas-ip:18888/auth/first-login \
  -H "Content-Type: application/json" \
  -d '{}'
```
(Replace `18888` with your custom `BACKEND_PORT` if set)

**Alternative: Environment Variable Method**

You can also set `SYNOLOGY_OTP_CODE` in environment variables, but this is less convenient due to OTP expiration.

### Authentication Flow Details

1. **First Login**:
   - Requires: Username + Password + OTP code (if 2FA enabled)
   - Uses OTP code from API endpoint or environment variables
   - Enables device token (`enable_device_token=yes`)
   - Stores device ID (DID) for future logins

2. **Subsequent Logins**:
   - Requires: Username + Password + Device ID
   - Uses stored device ID to skip OTP requirement
   - **Note**: Password is still required - device token only eliminates OTP
   - Automatically renews session when expired
   - Maintains CSRF token (SynoToken) for security

3. **Session Management**:
   - Sessions are encrypted and stored locally
   - Automatic validation and renewal
   - 6-day default expiry (configurable)

## Security Features

- ✅ Environment variable configuration (no hardcoded credentials)
- ✅ Encrypted session storage
- ✅ CSRF protection with SynoToken
- ✅ Device token authentication (reduces OTP friction)
- ✅ Secure session validation

## Project Structure

```
SynoReverseProxy/
├── backend/                # Backend Python application
│   ├── app/                # Main application package
│   │   ├── main.py        # FastAPI app initialization
│   │   ├── api/           # API routes
│   │   │   ├── dependencies.py
│   │   │   └── routes/
│   │   │       ├── rules.py
│   │   │       └── import_export.py
│   │   ├── core/          # Core business logic
│   │   │   ├── config.py
│   │   │   ├── synology.py
│   │   │   └── auth.py
│   │   ├── models/        # Pydantic models
│   │   │   └── schemas.py
│   │   └── utils/         # Utilities
│   │       └── encryption.py
│   └── requirements.txt
├── frontend/              # React frontend application
│   ├── src/
│   │   ├── App.js
│   │   └── App.css
│   └── package.json
├── scripts/               # Utility scripts
│   ├── start.sh
│   └── stop.sh
├── config/                # Configuration files
│   ├── .env.example
│   └── .env               # (not in git)
├── data/                  # Runtime data (not in git)
│   ├── syno_key.key
│   └── syno_session.json.enc
├── logs/                  # Log files (not in git)
│   ├── backend.log
│   └── frontend.log
├── samples/               # Sample/test files
└── README.md
```

## Configuration

### Environment Variables

| Variable            | Required | Description                     | Default |
| ------------------- | -------- | ------------------------------- | ------- |
| `SYNOLOGY_NAS_URL`  | Yes      | Your NAS URL (http://ip:port)   | -       |
| `SYNOLOGY_USERNAME` | Yes      | DSM username                    | -       |
| `SYNOLOGY_PASSWORD` | Yes      | DSM password                    | -       |
| `SYNOLOGY_OTP_CODE` | No\*     | 2FA OTP code (first login only) | -       |

\* OTP code is only needed for the first login. After device token is obtained, it's not required. **Note**: Password is always required - device token only skips OTP, not password. **Recommended**: Use the `/auth/first-login` API endpoint instead of setting this environment variable (see [First Login Setup](#first-login-setup)).
| `SYNOLOGY_DEVICE_NAME` | No | Device identifier | Hostname |
| `SYNOLOGY_SESSION_EXPIRY_SECS` | No | Session expiry in seconds | 518400 (6 days) |

## Troubleshooting

### Authentication Issues

- **"Login failed"**: Check your credentials. If using 2FA, ensure OTP code is correct and not expired
- **"2FA authentication required"**: Your account has 2FA enabled. Call `/auth/first-login` with an OTP code
- **"No valid session or device token found"**: You need to call `/auth/first-login` first (see [First Login Setup](#first-login-setup))
- **"Session expired"**: The app will automatically renew, but check network connectivity
- **"Device token not working"**: Delete `data/syno_session.json.enc` and call `/auth/first-login` again

### API Issues

- **CORS errors**: Ensure backend is running and CORS is configured
- **404 errors**: Check that the API endpoint URLs are correct
- **500 errors**: Check backend logs for detailed error messages

### Frontend Issues

- **Rules not loading**: Verify backend is running on port 8000
- **Form not submitting**: Check browser console for errors
- **Styling issues**: Clear browser cache and rebuild

## Development

### Backend Development

```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend Development

```bash
cd frontend
npm start
```

## License

This project is provided as-is for managing Synology reverse proxy rules.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Security Notes

- Never commit `.env` files
- Rotate credentials regularly
- Use strong passwords
- Enable 2FA on your Synology NAS
- Keep dependencies updated

## Changelog

### Version 2.0 (Current)

- ✅ Upgraded to API v6 with device tokens
- ✅ Added SynoToken CSRF protection
- ✅ Environment variable configuration
- ✅ Modern React UI with full CRUD
- ✅ Search and filter functionality
- ✅ Responsive design
- ✅ Improved error handling

### Version 1.0

- Basic authentication with API v3
- Simple create/list functionality
- Basic React UI
