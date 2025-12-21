#!/usr/bin/env python3
"""
Quick login test script to debug authentication issues.
Note: This script does not print actual passwords for security.
"""
import sys
import os
# Add backend to path (tests/ is at root level, so go up one level then into backend)
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
    
    # Test with default admin/admin
    print("\n--- Testing with default credentials (admin/admin) ---")
    result = verify_web_credentials("admin", "admin")
    print(f"Result: {'✓ Valid' if result else '✗ Invalid'}")
    
    # Test with custom password if provided (but don't print it)
    if len(sys.argv) > 1:
        test_password = sys.argv[1]
        print(f"\n--- Testing with custom password (length: {len(test_password)}) ---")
        result = verify_web_credentials("admin", test_password)
        print(f"Result: {'✓ Valid' if result else '✗ Invalid'}")
    
    # Test password verification directly (without printing passwords)
    if auth_data and auth_data.get('password_hash'):
        print("\n--- Direct password verification test ---")
        stored_hash = auth_data.get('password_hash')
        test_passwords = ["admin"]
        if len(sys.argv) > 1:
            test_passwords.append(sys.argv[1])
        
        for i, pwd in enumerate(test_passwords):
            result = verify_password(pwd, stored_hash)
            password_label = "default (admin)" if i == 0 else f"custom (length: {len(pwd)})"
            print(f"Password '{password_label}': {'✓ Valid' if result else '✗ Invalid'}")

if __name__ == "__main__":
    test_login()






