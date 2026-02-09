"""Configuration management."""
import os
import socket
import secrets
from pathlib import Path

from dotenv import load_dotenv

# Load environment variables from config/.env
# This must happen before Settings class is instantiated
PROJECT_ROOT = Path(__file__).parent.parent.parent.parent
CONFIG_DIR = PROJECT_ROOT / "config"
ENV_FILE = CONFIG_DIR / ".env"

if ENV_FILE.exists():
    load_dotenv(dotenv_path=ENV_FILE)
else:
    # Fallback to root .env for backward compatibility
    root_env = PROJECT_ROOT / ".env"
    if root_env.exists():
        load_dotenv(dotenv_path=root_env)
    else:
        # Last resort: try loading from current directory
        load_dotenv()


class Settings:
    """Application settings loaded from environment variables."""
    
    def __init__(self):
        # Synology NAS Configuration
        nas_url = os.getenv('SYNOLOGY_NAS_URL', 'http://YOUR_NAS_IP:5000')
        
        # Validate and fix common URL format issues
        if nas_url and not nas_url.startswith(('http://', 'https://')):
            # Try to fix common mistake: http:IP -> http://IP
            if nas_url.startswith('http:'):
                nas_url = nas_url.replace('http:', 'http://', 1)
            elif nas_url.startswith('https:'):
                nas_url = nas_url.replace('https:', 'https://', 1)
            else:
                # Assume http:// if no protocol specified
                nas_url = f"http://{nas_url}"
        
        self.synology_nas_url = nas_url
        self.synology_username = os.getenv('SYNOLOGY_USERNAME')
        self.synology_password = os.getenv('SYNOLOGY_PASSWORD')
        self.synology_otp_code = os.getenv('SYNOLOGY_OTP_CODE') or None
        self.synology_device_name = os.getenv('SYNOLOGY_DEVICE_NAME') or socket.gethostname()
        self.synology_session_expiry_secs = int(os.getenv('SYNOLOGY_SESSION_EXPIRY_SECS', '518400'))
        # SSL certificate verification for Synology API connections
        # Default to True for security, can be disabled for self-signed certs in dev
        self.synology_ssl_verify = os.getenv('SYNOLOGY_SSL_VERIFY', 'true').lower() == 'true'
        
        # Web UI Authentication Configuration
        self.app_username = os.getenv('APP_USERNAME', 'admin')
        self.app_password = os.getenv('APP_PASSWORD')  # Optional, defaults to 'admin' if not set
        self.app_session_secret_key = os.getenv('APP_SESSION_SECRET_KEY') or secrets.token_urlsafe(32)
        self.app_session_expiry_secs = int(os.getenv('APP_SESSION_EXPIRY_SECS', '3600'))  # Default 1 hour
        self.app_remember_me_expiry_secs = int(os.getenv('APP_REMEMBER_ME_EXPIRY_SECS', '2592000'))  # Default 30 days
        # Security settings
        self.app_use_https = os.getenv('APP_USE_HTTPS', 'false').lower() == 'true'  # Enable secure cookies for HTTPS
        self.app_rate_limit_enabled = os.getenv('APP_RATE_LIMIT_ENABLED', 'true').lower() == 'true'
        self.app_rate_limit_max_attempts = int(os.getenv('APP_RATE_LIMIT_MAX_ATTEMPTS', '5'))  # Max failed attempts
        self.app_rate_limit_window = int(os.getenv('APP_RATE_LIMIT_WINDOW', '300'))  # 5 minutes window
        
        # Initialize web auth ONLY if both username and password are provided via env
        # Otherwise, setup will be required on first run
        if self.app_username and self.app_password:
            from app.core.web_auth import initialize_web_auth
            initialize_web_auth(self.app_username, self.app_password)
        
        # Validate required settings
        if not self.synology_username or not self.synology_password:
            raise ValueError(
                "SYNOLOGY_USERNAME and SYNOLOGY_PASSWORD must be set in environment variables or .env file"
            )
        
        # Validate NAS URL format
        if not self.synology_nas_url.startswith(('http://', 'https://')):
            raise ValueError(
                f"SYNOLOGY_NAS_URL must start with http:// or https://. Got: {self.synology_nas_url}"
            )


# Global settings instance
_settings = None


def get_settings() -> Settings:
    """Get or create settings instance."""
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings


# Get data and logs directories
DATA_DIR = PROJECT_ROOT / "data"
LOGS_DIR = PROJECT_ROOT / "logs"

# Ensure directories exist (handle permission errors gracefully)
try:
    DATA_DIR.mkdir(exist_ok=True, mode=0o755)
    LOGS_DIR.mkdir(exist_ok=True, mode=0o755)
except (PermissionError, OSError) as e:
    # If we can't create directories, log warning but continue
    # The directories might already exist or be created by Docker volume mount
    import warnings
    warnings.warn(f"Could not create data/logs directories: {e}. They may already exist or be mounted.")

# File paths
SESSION_FILE = str(DATA_DIR / "syno_session.json.enc")
KEY_FILE = str(DATA_DIR / "syno_key.key")

