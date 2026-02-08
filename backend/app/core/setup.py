"""First-run setup functionality for web authentication."""
import os
from typing import Optional, Dict, Any
from app.core.web_auth import load_web_auth, save_web_auth, hash_password


def is_setup_required() -> Dict[str, Any]:
    """Check if first-run setup is required.
    
    Returns:
        Dict with:
        - required: bool - Whether setup is needed
        - needs_username: bool - Whether username needs to be set
        - needs_password: bool - Whether password needs to be set
        - env_username: Optional[str] - Username from env if set
    """
    # Check environment variables
    env_username = os.getenv('APP_USERNAME')
    env_password = os.getenv('APP_PASSWORD')
    
    # Check if auth file exists and has valid data
    auth_data = load_web_auth()
    has_stored_auth = bool(auth_data and auth_data.get('password_hash'))
    
    # If both env vars are set, no setup needed
    if env_username and env_password:
        return {
            "required": False,
            "needs_username": False,
            "needs_password": False,
            "env_username": env_username
        }
    
    # If auth file exists with valid data, no setup needed
    if has_stored_auth:
        return {
            "required": False,
            "needs_username": False,
            "needs_password": False,
            "env_username": auth_data.get('username')
        }
    
    # Setup is required - determine what's needed
    needs_username = not bool(env_username)
    needs_password = not bool(env_password)
    
    return {
        "required": True,
        "needs_username": needs_username,
        "needs_password": needs_password,
        "env_username": env_username
    }


def complete_setup(username: Optional[str], password: str) -> bool:
    """Complete first-run setup by creating admin credentials.
    
    Args:
        username: Username to create (if not set via env)
        password: Password to set (if not set via env)
        
    Returns:
        True if setup completed successfully
    """
    setup_info = is_setup_required()
    
    if not setup_info["required"]:
        return False  # Setup not needed
    
    # Determine final username
    final_username = username if setup_info["needs_username"] else setup_info["env_username"]
    
    if not final_username:
        raise ValueError("Username is required")
    
    # Validate password
    if not password or len(password) < 8:
        raise ValueError("Password must be at least 8 characters")
    
    # Create auth credentials
    password_hash = hash_password(password)
    save_web_auth(final_username, password_hash)
    
    return True
