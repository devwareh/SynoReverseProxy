#!/usr/bin/env python3
"""
Security Testing Script for Synology Reverse Proxy Manager

Tests various security measures including:
- Authentication bypass attempts
- Session management
- Password security
- CSRF protection
- Input validation
- Rate limiting
- Information disclosure

Usage:
    python scripts/security_test.py [BASE_URL] [USERNAME] [PASSWORD]
    
Examples:
    python scripts/security_test.py
    python scripts/security_test.py http://localhost:18888 admin admin123
"""

import requests
import json
import time
import sys
from typing import Dict, List, Tuple

# Configuration (can be overridden via command line)
BASE_URL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:18888"
TEST_USERNAME = sys.argv[2] if len(sys.argv) > 2 else "admin"
TEST_PASSWORD = sys.argv[3] if len(sys.argv) > 3 else "admin123"
INVALID_PASSWORD = "wrong_password"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RESET = '\033[0m'

def print_test(name: str):
    print(f"\n{Colors.BLUE}[TEST]{Colors.RESET} {name}")

def print_pass(message: str):
    print(f"{Colors.GREEN}✓ PASS{Colors.RESET}: {message}")

def print_fail(message: str):
    print(f"{Colors.RED}✗ FAIL{Colors.RESET}: {message}")

def print_warn(message: str):
    print(f"{Colors.YELLOW}⚠ WARN{Colors.RESET}: {message}")

def test_authentication_bypass():
    """Test 1: Authentication Bypass Attempts"""
    print_test("Authentication Bypass Attempts")
    
    session = requests.Session()
    
    # Test 1.1: Access protected endpoint without authentication
    try:
        response = session.get(f"{BASE_URL}/rules")
        if response.status_code == 401:
            print_pass("Protected endpoints require authentication")
        else:
            print_fail(f"Protected endpoint accessible without auth (status: {response.status_code})")
    except Exception as e:
        print_fail(f"Error testing protected endpoint: {e}")
    
    # Test 1.2: Access with invalid session ID
    session.cookies.set("web_session_id", "invalid_session_id_12345")
    try:
        response = session.get(f"{BASE_URL}/rules")
        if response.status_code == 401:
            print_pass("Invalid session IDs are rejected")
        else:
            print_fail(f"Invalid session ID accepted (status: {response.status_code})")
    except Exception as e:
        print_fail(f"Error testing invalid session: {e}")
    
    # Test 1.3: Access with empty session ID
    session.cookies.set("web_session_id", "")
    try:
        response = session.get(f"{BASE_URL}/rules")
        if response.status_code == 401:
            print_pass("Empty session IDs are rejected")
        else:
            print_fail(f"Empty session ID accepted (status: {response.status_code})")
    except Exception as e:
        print_fail(f"Error testing empty session: {e}")

def test_login_security():
    """Test 2: Login Security"""
    print_test("Login Security")
    
    session = requests.Session()
    
    # Test 2.1: Login with correct credentials
    try:
        response = session.post(
            f"{BASE_URL}/auth/login",
            json={"username": TEST_USERNAME, "password": TEST_PASSWORD},
            headers={"Content-Type": "application/json"}
        )
        if response.status_code == 200:
            print_pass("Login with correct credentials works")
            cookie = response.cookies.get("web_session_id")
            if cookie:
                print_pass("Session cookie is set")
                # Check cookie attributes
                cookie_obj = response.cookies.get("web_session_id")
                if hasattr(cookie_obj, 'has_nonstandard_attr') or 'HttpOnly' in str(response.headers.get('Set-Cookie', '')):
                    print_pass("Cookie has HttpOnly flag")
                else:
                    print_warn("Cookie may not have HttpOnly flag (check Set-Cookie header)")
            else:
                print_fail("Session cookie not set")
        else:
            print_fail(f"Login failed with correct credentials (status: {response.status_code})")
    except Exception as e:
        print_fail(f"Error testing login: {e}")
    
    # Test 2.2: Login with incorrect password
    session = requests.Session()
    try:
        response = session.post(
            f"{BASE_URL}/auth/login",
            json={"username": TEST_USERNAME, "password": INVALID_PASSWORD},
            headers={"Content-Type": "application/json"}
        )
        if response.status_code == 401:
            print_pass("Login with incorrect password is rejected")
        else:
            print_fail(f"Incorrect password accepted (status: {response.status_code})")
    except Exception as e:
        print_fail(f"Error testing incorrect password: {e}")
    
    # Test 2.3: Login with non-existent user
    session = requests.Session()
    try:
        response = session.post(
            f"{BASE_URL}/auth/login",
            json={"username": "nonexistent_user", "password": "any_password"},
            headers={"Content-Type": "application/json"}
        )
        if response.status_code == 401:
            print_pass("Non-existent user login is rejected")
        else:
            print_fail(f"Non-existent user accepted (status: {response.status_code})")
    except Exception as e:
        print_fail(f"Error testing non-existent user: {e}")
    
    # Test 2.4: Login with SQL injection attempt
    session = requests.Session()
    try:
        response = session.post(
            f"{BASE_URL}/auth/login",
            json={"username": "admin' OR '1'='1", "password": "anything"},
            headers={"Content-Type": "application/json"}
        )
        if response.status_code == 401:
            print_pass("SQL injection attempt rejected")
        else:
            print_warn(f"SQL injection attempt returned status {response.status_code}")
    except Exception as e:
        print_fail(f"Error testing SQL injection: {e}")

def test_session_management():
    """Test 3: Session Management"""
    print_test("Session Management")
    
    # Test 3.1: Session expiration
    session = requests.Session()
    try:
        # Login
        response = session.post(
            f"{BASE_URL}/auth/login",
            json={"username": TEST_USERNAME, "password": TEST_PASSWORD, "remember_me": False},
            headers={"Content-Type": "application/json"}
        )
        if response.status_code == 200:
            # Access protected endpoint
            response = session.get(f"{BASE_URL}/rules")
            if response.status_code == 200:
                print_pass("Session works after login")
            else:
                print_fail(f"Session not working after login (status: {response.status_code})")
        else:
            print_fail("Could not login for session test")
    except Exception as e:
        print_fail(f"Error testing session: {e}")
    
    # Test 3.2: Logout invalidates session
    session = requests.Session()
    try:
        # Login
        response = session.post(
            f"{BASE_URL}/auth/login",
            json={"username": TEST_USERNAME, "password": TEST_PASSWORD},
            headers={"Content-Type": "application/json"}
        )
        if response.status_code == 200:
            # Logout
            response = session.post(f"{BASE_URL}/auth/logout")
            if response.status_code == 200:
                # Try to access protected endpoint
                response = session.get(f"{BASE_URL}/rules")
                if response.status_code == 401:
                    print_pass("Logout invalidates session")
                else:
                    print_fail(f"Session still valid after logout (status: {response.status_code})")
            else:
                print_fail(f"Logout failed (status: {response.status_code})")
        else:
            print_fail("Could not login for logout test")
    except Exception as e:
        print_fail(f"Error testing logout: {e}")

def test_password_security():
    """Test 4: Password Security"""
    print_test("Password Security")
    
    session = requests.Session()
    
    # Login first
    response = session.post(
        f"{BASE_URL}/auth/login",
        json={"username": TEST_USERNAME, "password": TEST_PASSWORD},
        headers={"Content-Type": "application/json"}
    )
    
    if response.status_code != 200:
        print_fail("Could not login for password change test")
        return
    
    # Test 4.1: Password change with incorrect current password
    try:
        response = session.post(
            f"{BASE_URL}/auth/change-password",
            json={"current_password": "wrong", "new_password": "newpass123"},
            headers={"Content-Type": "application/json"}
        )
        if response.status_code == 400:
            print_pass("Password change requires correct current password")
        else:
            print_fail(f"Password change accepted with wrong current password (status: {response.status_code})")
    except Exception as e:
        print_fail(f"Error testing password change: {e}")
    
    # Test 4.2: Password change with short password
    try:
        response = session.post(
            f"{BASE_URL}/auth/change-password",
            json={"current_password": TEST_PASSWORD, "new_password": "short"},
            headers={"Content-Type": "application/json"}
        )
        if response.status_code == 400:
            print_pass("Short passwords are rejected")
        else:
            print_warn(f"Short password accepted (status: {response.status_code})")
    except Exception as e:
        print_fail(f"Error testing short password: {e}")

def test_rate_limiting():
    """Test 5: Rate Limiting (Brute Force Protection)"""
    print_test("Rate Limiting / Brute Force Protection")
    
    session = requests.Session()
    
    # Attempt multiple failed logins
    failed_attempts = 0
    for i in range(10):
        try:
            response = session.post(
                f"{BASE_URL}/auth/login",
                json={"username": TEST_USERNAME, "password": f"wrong{i}"},
                headers={"Content-Type": "application/json"}
            )
            if response.status_code == 401:
                failed_attempts += 1
        except Exception as e:
            print_fail(f"Error during brute force test: {e}")
            return
    
    if failed_attempts == 10:
        print_warn("No rate limiting detected - 10 failed login attempts all processed")
        print_warn("Consider implementing rate limiting to prevent brute force attacks")
    else:
        print_pass(f"Rate limiting may be active ({failed_attempts}/10 attempts processed)")

def test_information_disclosure():
    """Test 6: Information Disclosure"""
    print_test("Information Disclosure")
    
    session = requests.Session()
    
    # Test 6.1: Error messages don't reveal user existence
    try:
        response = session.post(
            f"{BASE_URL}/auth/login",
            json={"username": "nonexistent", "password": "wrong"},
            headers={"Content-Type": "application/json"}
        )
        if response.status_code == 401:
            data = response.json()
            # Check if error message reveals user existence
            if "user" in str(data).lower() and "exist" in str(data).lower():
                print_warn("Error message may reveal user existence")
            else:
                print_pass("Error messages don't reveal user existence")
        else:
            print_fail(f"Unexpected status code: {response.status_code}")
    except Exception as e:
        print_fail(f"Error testing information disclosure: {e}")
    
    # Test 6.2: Check if stack traces are exposed
    try:
        # Try to trigger an error
        response = session.get(f"{BASE_URL}/rules/invalid_id_that_should_404")
        if "traceback" in response.text.lower() or "exception" in response.text.lower():
            print_warn("Stack traces may be exposed in error responses")
        else:
            print_pass("No stack traces exposed")
    except Exception as e:
        print_fail(f"Error testing stack trace exposure: {e}")

def test_csrf_protection():
    """Test 7: CSRF Protection"""
    print_test("CSRF Protection")
    
    # Test 7.1: Check if SameSite cookie attribute is set
    session = requests.Session()
    try:
        response = session.post(
            f"{BASE_URL}/auth/login",
            json={"username": TEST_USERNAME, "password": TEST_PASSWORD},
            headers={"Content-Type": "application/json"}
        )
        set_cookie = response.headers.get("Set-Cookie", "")
        if "SameSite" in set_cookie:
            print_pass("SameSite cookie attribute is set")
        else:
            print_warn("SameSite cookie attribute not found - CSRF protection may be weak")
    except Exception as e:
        print_fail(f"Error testing CSRF protection: {e}")

def test_input_validation():
    """Test 8: Input Validation"""
    print_test("Input Validation")
    
    session = requests.Session()
    
    # Test 8.1: XSS attempt in username
    try:
        response = session.post(
            f"{BASE_URL}/auth/login",
            json={"username": "<script>alert('xss')</script>", "password": "test"},
            headers={"Content-Type": "application/json"}
        )
        if response.status_code == 401:
            print_pass("XSS attempt in username rejected")
        else:
            print_warn(f"XSS attempt returned status {response.status_code}")
    except Exception as e:
        print_fail(f"Error testing XSS: {e}")
    
    # Test 8.2: Very long password
    try:
        response = session.post(
            f"{BASE_URL}/auth/login",
            json={"username": TEST_USERNAME, "password": "a" * 10000},
            headers={"Content-Type": "application/json"}
        )
        if response.status_code in [400, 401, 413]:
            print_pass("Very long password handled appropriately")
        else:
            print_warn(f"Very long password returned status {response.status_code}")
    except Exception as e:
        print_fail(f"Error testing long password: {e}")

def main():
    print(f"\n{Colors.BLUE}{'='*60}{Colors.RESET}")
    print(f"{Colors.BLUE}Security Testing for Synology Reverse Proxy Manager{Colors.RESET}")
    print(f"{Colors.BLUE}{'='*60}{Colors.RESET}")
    print(f"\nTesting against: {BASE_URL}")
    print(f"Test credentials: {TEST_USERNAME}/{TEST_PASSWORD}")
    
    try:
        # Check if server is running
        response = requests.get(f"{BASE_URL}/", timeout=5)
        if response.status_code != 200:
            print_fail(f"Server not responding correctly (status: {response.status_code})")
            sys.exit(1)
    except requests.exceptions.ConnectionError:
        print_fail(f"Cannot connect to {BASE_URL}")
        print("Make sure the backend server is running!")
        sys.exit(1)
    except Exception as e:
        print_fail(f"Error connecting to server: {e}")
        sys.exit(1)
    
    print_pass("Server is reachable")
    
    # Run all tests
    test_authentication_bypass()
    test_login_security()
    test_session_management()
    test_password_security()
    test_rate_limiting()
    test_information_disclosure()
    test_csrf_protection()
    test_input_validation()
    
    print(f"\n{Colors.BLUE}{'='*60}{Colors.RESET}")
    print(f"{Colors.BLUE}Security Testing Complete{Colors.RESET}")
    print(f"{Colors.BLUE}{'='*60}{Colors.RESET}\n")

if __name__ == "__main__":
    main()

