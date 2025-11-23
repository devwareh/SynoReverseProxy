#!/usr/bin/env python3
"""
Quick login test script to debug authentication issues.
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'backend'))

from app.core.web_auth import verify_web_credentials, load_web_auth, hash_password, verify_password

def test_login():
    print("Testing web authentication...")
    
    # Load auth data
    auth_data = load_web_auth()
    print(f"\nAuth file exists: {auth_data is not None}")
    
    if auth_data:
        print(f"Stored username: {auth_data.get('username')}")
        print(f"Has password hash: {bool(auth_data.get('password_hash'))}")
        if auth_data.get('password_hash'):
            print(f"Password hash length: {len(auth_data.get('password_hash'))}")
    
    # Test with admin/admin
    print("\n--- Testing admin/admin ---")
    result = verify_web_credentials("admin", "admin")
    print(f"Result: {result}")
    
    # Test with what user might have set
    if len(sys.argv) > 1:
        test_password = sys.argv[1]
        print(f"\n--- Testing admin/{test_password} ---")
        result = verify_web_credentials("admin", test_password)
        print(f"Result: {result}")
    
    # Test password verification directly
    if auth_data and auth_data.get('password_hash'):
        print("\n--- Direct password verification test ---")
        stored_hash = auth_data.get('password_hash')
        test_passwords = ["admin"]
        if len(sys.argv) > 1:
            test_passwords.append(sys.argv[1])
        
        for pwd in test_passwords:
            result = verify_password(pwd, stored_hash)
            print(f"Password '{pwd}': {result}")

if __name__ == "__main__":
    test_login()

