#!/usr/bin/env python3
"""
Test script for session persistence functionality.
Tests encryption, persistence, expiry, and cleanup.
"""
import sys
import os
import time
import json
import tempfile
import shutil
from pathlib import Path

# Add backend to path (tests/ is at root level, so go up one level then into backend)
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'backend'))

def test_session_persistence():
    """Test session persistence to disk."""
    print("=" * 60)
    print("TEST 1: Session Persistence")
    print("=" * 60)
    
    from app.core.web_auth import (
        create_session, 
        validate_session, 
        get_session_username,
        load_web_sessions,
        save_web_sessions,
        WEB_SESSIONS_FILE
    )
    from app.core.config import DATA_DIR
    
    # Backup original file if it exists
    backup_path = None
    if WEB_SESSIONS_FILE.exists():
        backup_path = WEB_SESSIONS_FILE.with_suffix('.enc.backup')
        shutil.copy2(WEB_SESSIONS_FILE, backup_path)
        print(f"✓ Backed up existing session file to {backup_path}")
    
    try:
        # Clear existing sessions
        if WEB_SESSIONS_FILE.exists():
            WEB_SESSIONS_FILE.unlink()
        
        # Create a test session
        session_id = create_session("testuser", remember_me=False)
        print(f"✓ Created session: {session_id[:20]}...")
        
        # Verify file was created
        assert WEB_SESSIONS_FILE.exists(), "Session file should be created"
        print(f"✓ Session file created: {WEB_SESSIONS_FILE}")
        
        # Verify file is encrypted (not plain JSON)
        with open(WEB_SESSIONS_FILE, 'rb') as f:
            content = f.read()
            # Encrypted content should not be valid JSON when decoded
            try:
                json.loads(content.decode('utf-8'))
                assert False, "File should be encrypted, not plain JSON"
            except (json.JSONDecodeError, UnicodeDecodeError):
                pass  # Expected - file is encrypted
        print("✓ Session file is encrypted")
        
        # Verify file permissions (should be 600)
        stat = WEB_SESSIONS_FILE.stat()
        mode = stat.st_mode & 0o777
        if mode == 0o600:
            print("✓ File permissions are 600 (read/write owner only)")
        else:
            print(f"⚠ File permissions are {oct(mode)} (expected 600)")
        
        # Test loading sessions
        loaded_sessions = load_web_sessions()
        assert session_id in loaded_sessions, "Session should be loaded from disk"
        print(f"✓ Session loaded from disk: {len(loaded_sessions)} session(s)")
        
        # Verify session data
        session_data = loaded_sessions[session_id]
        assert session_data['username'] == 'testuser', "Username should match"
        assert 'expires_at' in session_data, "Should have expiry time"
        assert 'created_at' in session_data, "Should have creation time"
        print("✓ Session data is correct")
        
        # Test validation
        assert validate_session(session_id), "Session should be valid"
        username = get_session_username(session_id)
        assert username == "testuser", "Should retrieve correct username"
        print("✓ Session validation works")
        
        print("\n✅ TEST 1 PASSED: Session persistence works correctly\n")
        return True
        
    except Exception as e:
        print(f"\n❌ TEST 1 FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        # Restore backup if it existed
        if backup_path and backup_path.exists():
            shutil.copy2(backup_path, WEB_SESSIONS_FILE)
            backup_path.unlink()
            print(f"✓ Restored original session file")


def test_session_expiry():
    """Test that expired sessions are cleaned up."""
    print("=" * 60)
    print("TEST 2: Session Expiry Cleanup")
    print("=" * 60)
    
    from app.core.web_auth import (
        load_web_sessions,
        cleanup_expired_sessions,
        WEB_SESSIONS_FILE
    )
    from app.utils.encryption import FERNET
    
    backup_path = None
    if WEB_SESSIONS_FILE.exists():
        backup_path = WEB_SESSIONS_FILE.with_suffix('.enc.backup2')
        shutil.copy2(WEB_SESSIONS_FILE, backup_path)
    
    try:
        # Create test sessions with expired and valid times
        now = time.time()
        test_sessions = {
            "expired_session": {
                "username": "user1",
                "created_at": now - 7200,  # 2 hours ago
                "expires_at": now - 3600,  # Expired 1 hour ago
                "remember_me": False
            },
            "valid_session": {
                "username": "user2",
                "created_at": now - 1800,  # 30 minutes ago
                "expires_at": now + 1800,  # Valid for 30 more minutes
                "remember_me": False
            }
        }
        
        # Save test sessions
        sessions_json = json.dumps(test_sessions)
        encrypted = FERNET.encrypt(sessions_json.encode('utf-8'))
        WEB_SESSIONS_FILE.parent.mkdir(exist_ok=True, mode=0o755)
        with open(WEB_SESSIONS_FILE, 'wb') as f:
            f.write(encrypted)
        WEB_SESSIONS_FILE.chmod(0o600)
        print("✓ Created test sessions (1 expired, 1 valid)")
        
        # Load and verify both are present
        loaded = load_web_sessions()
        assert "expired_session" not in loaded, "Expired session should be filtered out"
        assert "valid_session" in loaded, "Valid session should be present"
        print("✓ Expired session filtered out on load")
        
        # Test cleanup function
        # First, manually add expired session back to in-memory dict
        from app.core.web_auth import _sessions
        _sessions["expired_session"] = test_sessions["expired_session"]
        _sessions["valid_session"] = test_sessions["valid_session"]
        
        cleanup_expired_sessions()
        
        # Verify expired session removed
        assert "expired_session" not in _sessions, "Expired session should be removed"
        assert "valid_session" in _sessions, "Valid session should remain"
        print("✓ Cleanup function removes expired sessions")
        
        # Verify file was updated
        loaded_after = load_web_sessions()
        assert "expired_session" not in loaded_after, "Expired session should not be in file"
        assert "valid_session" in loaded_after, "Valid session should be in file"
        print("✓ File updated after cleanup")
        
        print("\n✅ TEST 2 PASSED: Session expiry cleanup works correctly\n")
        return True
        
    except Exception as e:
        print(f"\n❌ TEST 2 FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        if backup_path and backup_path.exists():
            shutil.copy2(backup_path, WEB_SESSIONS_FILE)
            backup_path.unlink()


def test_password_change_invalidation():
    """Test that password change invalidates all sessions."""
    print("=" * 60)
    print("TEST 3: Password Change Session Invalidation")
    print("=" * 60)
    
    from app.core.web_auth import (
        create_session,
        validate_session,
        update_password,
        initialize_web_auth,
        load_web_sessions,
        WEB_SESSIONS_FILE
    )
    from app.core.config import CONFIG_DIR
    
    # Backup files
    session_backup = None
    auth_backup = None
    auth_file = CONFIG_DIR / ".web_auth.json"
    
    if WEB_SESSIONS_FILE.exists():
        session_backup = WEB_SESSIONS_FILE.with_suffix('.enc.backup3')
        shutil.copy2(WEB_SESSIONS_FILE, session_backup)
    if auth_file.exists():
        auth_backup = auth_file.with_suffix('.json.backup')
        shutil.copy2(auth_file, auth_backup)
    
    try:
        # Initialize auth with test credentials
        initialize_web_auth("testuser", "testpassword123", force_update=True)
        print("✓ Initialized test authentication")
        
        # Create multiple sessions
        session1 = create_session("testuser", remember_me=False)
        session2 = create_session("testuser", remember_me=True)
        print(f"✓ Created 2 sessions")
        
        # Verify sessions are valid
        assert validate_session(session1), "Session 1 should be valid"
        assert validate_session(session2), "Session 2 should be valid"
        print("✓ Both sessions are valid")
        
        # Change password
        result = update_password("testpassword123", "newtestpassword456")
        assert result, "Password update should succeed"
        print("✓ Password changed")
        
        # Verify sessions are invalidated
        # Note: _sessions dict is cleared, so we need to check file
        loaded = load_web_sessions()
        assert session1 not in loaded, "Session 1 should be invalidated"
        assert session2 not in loaded, "Session 2 should be invalidated"
        print("✓ All sessions invalidated after password change")
        
        print("\n✅ TEST 3 PASSED: Password change invalidates sessions\n")
        return True
        
    except Exception as e:
        print(f"\n❌ TEST 3 FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        if session_backup and session_backup.exists():
            shutil.copy2(session_backup, WEB_SESSIONS_FILE)
            session_backup.unlink()
        if auth_backup and auth_backup.exists():
            shutil.copy2(auth_backup, auth_file)
            auth_backup.unlink()


def test_corrupted_file_handling():
    """Test handling of corrupted session files."""
    print("=" * 60)
    print("TEST 4: Corrupted File Handling")
    print("=" * 60)
    
    from app.core.web_auth import load_web_sessions, WEB_SESSIONS_FILE
    
    backup_path = None
    if WEB_SESSIONS_FILE.exists():
        backup_path = WEB_SESSIONS_FILE.with_suffix('.enc.backup4')
        shutil.copy2(WEB_SESSIONS_FILE, backup_path)
    
    try:
        # Test with corrupted encrypted data
        WEB_SESSIONS_FILE.parent.mkdir(exist_ok=True, mode=0o755)
        with open(WEB_SESSIONS_FILE, 'wb') as f:
            f.write(b"corrupted encrypted data")
        WEB_SESSIONS_FILE.chmod(0o600)
        print("✓ Created corrupted session file")
        
        # Should handle gracefully and return empty dict
        sessions = load_web_sessions()
        assert sessions == {}, "Should return empty dict for corrupted file"
        print("✓ Corrupted file handled gracefully")
        
        # Test with empty file
        with open(WEB_SESSIONS_FILE, 'wb') as f:
            f.write(b"")
        sessions = load_web_sessions()
        assert sessions == {}, "Should return empty dict for empty file"
        print("✓ Empty file handled gracefully")
        
        # Test with non-existent file
        if WEB_SESSIONS_FILE.exists():
            WEB_SESSIONS_FILE.unlink()
        sessions = load_web_sessions()
        assert sessions == {}, "Should return empty dict for non-existent file"
        print("✓ Non-existent file handled gracefully")
        
        print("\n✅ TEST 4 PASSED: Corrupted file handling works\n")
        return True
        
    except Exception as e:
        print(f"\n❌ TEST 4 FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        if backup_path and backup_path.exists():
            shutil.copy2(backup_path, WEB_SESSIONS_FILE)
            backup_path.unlink()


def main():
    """Run all tests."""
    print("\n" + "=" * 60)
    print("SESSION PERSISTENCE TEST SUITE")
    print("=" * 60 + "\n")
    
    results = []
    
    results.append(("Session Persistence", test_session_persistence()))
    results.append(("Session Expiry", test_session_expiry()))
    results.append(("Password Change Invalidation", test_password_change_invalidation()))
    results.append(("Corrupted File Handling", test_corrupted_file_handling()))
    
    # Summary
    print("=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {name}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 All tests passed!")
        return 0
    else:
        print(f"\n⚠️  {total - passed} test(s) failed")
        return 1


if __name__ == "__main__":
    sys.exit(main())






