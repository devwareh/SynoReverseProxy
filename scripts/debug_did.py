#!/usr/bin/env python3
"""
Debug script to test Synology DID (Device ID) authentication.
This script attempts to login using the stored DID without an OTP.
"""
import os
import sys
import json
import requests
import time
from pathlib import Path

# Add backend path to sys.path
import sys
from pathlib import Path
BACKEND_DIR = Path(__file__).parent.parent / "backend"
sys.path.append(str(BACKEND_DIR))

# Import from app package (now that backend is in path)
from app.core.config import get_settings
from app.utils.encryption import load_session

def debug_did_login():
    print("=" * 60)
    print("Synology DID Debug Tool")
    print("=" * 60)
    
    # 1. Load settings
    try:
        settings = get_settings()
        print(f"URL: {settings.synology_nas_url}")
        print(f"User: {settings.synology_username}")
    except Exception as e:
        print(f"Error loading settings: {e}")
        return

    # 2. Load existing session/DID
    print("\n[1] Checking stored session...")
    session_data = load_session()
    
    if not session_data:
        print("❌ No session file found or could not decrypt.")
        return
        
    did = session_data.get('did')
    if not did:
        print("❌ Session file exists but contains NO Device ID (did).")
        return
        
    print(f"✅ Found DID: {did[:10]}...{did[-10:]}")
    sid = session_data.get('sid')
    print(f"   Stored SID: {sid[:10] + '...' if sid else 'None'}")
    
    # 3. Attempt Login using ONLY the DID (no OTP)
    print("\n[2] Attempting login with DID (skipping OTP)...")
    
    login_url = f"{settings.synology_nas_url}/webapi/entry.cgi"
    params = {
        "api": "SYNO.API.Auth",
        "method": "login",
        "version": "6",
        "account": settings.synology_username,
        "passwd": settings.synology_password,
        "session": "Core",
        "format": "sid",
        "enable_syno_token": "yes",
        "device_id": did,
        "device_name": settings.synology_device_name
    }
    
    try:
        # Disable cert warnings for testing
        requests.packages.urllib3.disable_warnings() 
        
        start_time = time.time()
        response = requests.get(login_url, params=params, verify=False, timeout=15)
        duration = time.time() - start_time
        
        print(f"   Request took {duration:.2f}s")
        print(f"   Status Code: {response.status_code}")
        
        result = response.json()
        
        if result.get('success'):
            print(f"\n✅ SUCCESS! Login successful using DID.")
            print(f"   New SID: {result['data']['sid'][:15]}...")
            print("   The DID is valid and trusted by the NAS.")
        else:
            print(f"\n❌ FAILED. The NAS rejected the login.")
            print(f"   Error Code: {result.get('error', {}).get('code')}")
            
            error_details = result.get('error', {}).get('errors', {})
            print(f"   Full Response: {json.dumps(result, indent=2)}")
            
            if 'token' in error_details and error_details.get('types', [{}])[0].get('type') == 'otp':
                print("\n⚠️  DIAGNOSIS: OTP REQUIRED")
                print("   The NAS recognized credentials but requires 2FA.")
                print("   This means the DID is either invalid, expired, or not trusted.")
                print("   ACTION: You must perform a login with a fresh OTP code to re-trust this device.")

    except Exception as e:
        print(f"\n❌ Exception during request: {e}")

if __name__ == "__main__":
    debug_did_login()
