import requests
import json
import os
import time
from cryptography.fernet import Fernet

# === CONFIGURATION ===
# WARNING: Replace these with your actual values. Never commit real credentials!
NAS_URL = 'http://YOUR_NAS_IP:5000'  # Use HTTP unless SSL certs are solved
USERNAME = 'your_username'
PASSWORD = 'your_password'
OTP_CODE = None  # Set to your OTP code if using 2FA, or None if not using 2FA
SESSION_FILE = 'syno_session.json.enc'
KEY_FILE = 'syno_key.key'
SESSION_EXPIRY_SECS = 6 * 24 * 3600  # 6 days; DSM sid usually lasts a few days


# === ENCRYPTION KEY MANAGEMENT ===
def load_or_generate_key():
    if os.path.exists(KEY_FILE):
        with open(KEY_FILE, 'rb') as f:
            return f.read()
    key = Fernet.generate_key()
    with open(KEY_FILE, 'wb') as f:
        f.write(key)
    return key


FERNET = Fernet(load_or_generate_key())


# === SESSION MANAGEMENT ===
def save_session(sid, expiry_time):
    """Encrypt and persist session ID and expiry time."""
    data = {'sid': sid, 'expiry_time': expiry_time}
    encrypted = FERNET.encrypt(json.dumps(data).encode('utf-8'))
    with open(SESSION_FILE, 'wb') as f:
        f.write(encrypted)


def load_session():
    if not os.path.exists(SESSION_FILE):
        return None
    try:
        with open(SESSION_FILE, 'rb') as f:
            decrypted = FERNET.decrypt(f.read())
        data = json.loads(decrypted)
        sid = data.get('sid')
        expiry = data.get('expiry_time')
        if not sid or (expiry and time.time() > expiry):
            return None
        return sid
    except Exception:
        return None


def get_new_sid():
    """Authenticate with DSM, handling OTP if configured."""
    login_url = f"{NAS_URL}/webapi/auth.cgi"
    params = {
        "api": "SYNO.API.Auth",
        "method": "login",
        "version": "3",
        "account": USERNAME,
        "passwd": PASSWORD,
        "session": "Core",
        "format": "sid",
    }
    if OTP_CODE:
        params["otp_code"] = OTP_CODE
    session = requests.Session()
    resp = session.get(login_url, params=params, verify=False)
    resp.raise_for_status()
    result = resp.json()
    if not result.get('success'):
        raise Exception(f"Login failed: {result}")
    sid = result["data"]["sid"]
    expiry_time = time.time() + SESSION_EXPIRY_SECS
    save_session(sid, expiry_time)
    return sid


def is_sid_valid(sid):
    """Quickly check SID validity via harmless Core.System info API."""
    check_url = f"{NAS_URL}/webapi/entry.cgi"
    params = {
        "api": "SYNO.Core.System",
        "method": "info",
        "version": "1",
        "_sid": sid
    }
    try:
        resp = requests.get(check_url, params=params, verify=False, timeout=10)
        result = resp.json()
        return result.get('success', False)
    except Exception:
        return False


# === REVERSE PROXY MANAGER ===
class SynoReverseProxyManager:
    def __init__(self, nas_url, sid, session=None):
        self.nas_url = nas_url.rstrip('/')
        self.sid = sid
        self.session = session or requests.Session()
        self.api_url = f"{self.nas_url}/webapi/entry.cgi"

    def list_rules(self):
        """List all existing reverse proxy entries."""
        payload = {
            "api": "SYNO.Core.AppPortal.ReverseProxy",
            "method": "list",
            "version": "1",
            "_sid": self.sid
        }
        resp = self.session.get(self.api_url, params=payload, verify=False)
        resp.raise_for_status()
        return resp.json()

    def create_rule(self, rule_dict):
        """Create a new reverse proxy rule using the correct entry parameter."""
        params = {
            "api": "SYNO.Core.AppPortal.ReverseProxy",
            "method": "create",
            "version": "1",
            "_sid": self.sid
        }
        # entry as JSON string, POSTed form-encoded!
        data = {"entry": json.dumps(rule_dict)}
        resp = self.session.post(self.api_url, params=params, data=data, verify=False)
        resp.raise_for_status()
        return resp.json()

    def build_rule(self,
                   *,
                   backend_fqdn,
                   backend_port,
                   frontend_fqdn,
                   description,
                   backend_protocol=0,
                   frontend_port=443,
                   frontend_protocol=1,
                   frontend_hsts=False,
                   customize_headers=None,
                   proxy_connect_timeout=60,
                   proxy_read_timeout=60,
                   proxy_send_timeout=60,
                   proxy_http_version=1,
                   proxy_intercept_errors=False,
                   acl=None,
                   ):
        """Smart builder for proxy rule, ensures all required values."""
        rule = {
            "description": description,
            "backend": {
                "fqdn": backend_fqdn,
                "port": backend_port,
                "protocol": backend_protocol
            },
            "frontend": {
                "fqdn": frontend_fqdn,
                "port": frontend_port,
                "protocol": frontend_protocol,
                "https": {"hsts": frontend_hsts}
            },
            "proxy_connect_timeout": proxy_connect_timeout,
            "proxy_read_timeout": proxy_read_timeout,
            "proxy_send_timeout": proxy_send_timeout,
            "proxy_http_version": proxy_http_version,
            "proxy_intercept_errors": proxy_intercept_errors
        }
        if acl is not None:
            rule["frontend"]["acl"] = acl
        if customize_headers is not None:
            rule["customize_headers"] = customize_headers
        return rule


# === MAIN LOGIC ===
def main():
    sid = load_session()
    if sid is None or not is_sid_valid(sid):
        print("🔐 Session missing or expired — logging in...")
        sid = get_new_sid()
    else:
        print("✅ Reusing existing session.")

    print(f"SID: {sid}")

    mgr = SynoReverseProxyManager(NAS_URL, sid)

    # List existing rules for context
    print("Existing reverse proxy entries:")
    try:
        existing = mgr.list_rules()
        print(json.dumps(existing, indent=2))
    except Exception as e:
        print(f"Error listing rules: {e}")

    # Example: create a new rule with robust field defaults
    rule = mgr.build_rule(
        backend_fqdn="localhost",
        backend_port=5000,
        frontend_fqdn="dsm.flnx.de",
        description="DSM",
        customize_headers=[
            {"name": "Upgrade", "value": "$http_upgrade"},
            {"name": "Connection", "value": "$connection_upgrade"}
        ],
        frontend_hsts=False
    )

    print("--- Attempting to create rule ---")
    try:
        result = mgr.create_rule(rule)
        print("--- Create rule result: ---")
        print(json.dumps(result, indent=2))
    except Exception as e:
        print(f"Failed to create rule: {e}")


if __name__ == "__main__":
    main()
