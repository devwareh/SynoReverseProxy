#!/usr/bin/env python3
"""
Debug script to test Synology authentication with OTP.
This script attempts to login using the credentials and OTP from .env file.
"""
import sys
import os
import requests
from pathlib import Path

# Add backend path to sys.path
BACKEND_DIR = Path(__file__).parent.parent / "backend"
sys.path.append(str(BACKEND_DIR))

# Import settings
from app.core.config import get_settings

def debug_login_with_otp():
    print("=" * 60)
    print("Synology Login Debug Tool")
    print("=" * 60)
    
    # 1. Load settings
    try:
        settings = get_settings()
        print(f"URL: {settings.synology_nas_url}")
        print(f"User: {settings.synology_username}")
        print(f"OTP Code in .env: {settings.synology_otp_code or 'Not set'}")
        
    except Exception as e:
        print(f"Error loading settings: {e}")
        return

    # 2. Attempt Login
    print("\n[ Attempting Login ]")
    
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
        "enable_device_token": "yes",
        "device_name": settings.synology_device_name
    }
    
    if settings.synology_otp_code:
        params["otp_code"] = settings.synology_otp_code
        print(f"   Including OTP Code: {settings.synology_otp_code}")
    else:
        print("   ⚠️  WARNING: No OTP code provided in settings!")
    
    try:
        # Disable cert warnings for testing
        requests.packages.urllib3.disable_warnings() 
        
        response = requests.get(login_url, params=params, verify=False, timeout=15)
        
        print(f"   Status Code: {response.status_code}")
        result = response.json()
        
        if result.get('success'):
            print(f"\n✅ SUCCESS! Login successful.")
            print(f"   SID: {result['data']['sid'][:15]}...")
            if 'did' in result['data']:
                print(f"   DID: {result['data']['did'][:15]}... (New Device ID received!)")
            else:
                print("   ⚠️  Warning: No DID received in response.")
        else:
            print(f"\n❌ FAILED. Login rejected.")
            print(f"   Error Code: {result.get('error', {}).get('code')}")
            error_details = result.get('error', {}).get('errors', {})
            
            # Check specifically for OTP error
            if 'token' in error_details and error_details.get('types', [{}])[0].get('type') == 'otp':
                print("\n⚠️  DIAGNOSIS: OTP INVALID OR EXPIRED")
                print("   The NAS reports that the OTP code is incorrect.")
                print("   Verify that the time is synced on both devices.")

            import json
            print(f"   Full Response: {json.dumps(result, indent=2)}")

    except Exception as e:
        print(f"\n❌ Exception during request: {e}")

if __name__ == "__main__":
    debug_login_with_otp()
