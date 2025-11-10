"""Configuration management."""
import os
import socket
from pathlib import Path
from typing import Optional
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
        self.synology_nas_url = os.getenv('SYNOLOGY_NAS_URL', 'http://YOUR_NAS_IP:5000')
        self.synology_username = os.getenv('SYNOLOGY_USERNAME')
        self.synology_password = os.getenv('SYNOLOGY_PASSWORD')
        self.synology_otp_code = os.getenv('SYNOLOGY_OTP_CODE') or None
        self.synology_device_name = os.getenv('SYNOLOGY_DEVICE_NAME') or socket.gethostname()
        self.synology_session_expiry_secs = int(os.getenv('SYNOLOGY_SESSION_EXPIRY_SECS', '518400'))
        
        # Validate required settings
        if not self.synology_username or not self.synology_password:
            raise ValueError(
                "SYNOLOGY_USERNAME and SYNOLOGY_PASSWORD must be set in environment variables or .env file"
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

# Ensure directories exist
DATA_DIR.mkdir(exist_ok=True)
LOGS_DIR.mkdir(exist_ok=True)

# File paths
SESSION_FILE = str(DATA_DIR / "syno_session.json.enc")
KEY_FILE = str(DATA_DIR / "syno_key.key")

