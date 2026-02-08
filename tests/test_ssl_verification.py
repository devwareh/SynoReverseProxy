"""Tests for SSL certificate verification security.

These tests verify that SSL certificate verification is properly enabled
and cannot be disabled through configuration.
"""
import pytest
from unittest.mock import patch, MagicMock
import os


class TestSSLVerificationEnabled:
    """Test that SSL verification is always enabled for external connections."""

    def test_synology_api_ssl_verification_enabled(self):
        """Test that Synology API calls have SSL verification enabled.
        
        The get_new_session_with_otp function must verify SSL certificates
        when connecting to the Synology NAS API. This is a critical security
        requirement to prevent man-in-the-middle attacks.
        """
        # Read the auth.py file and check that verify is not set to False
        with open('backend/app/api/routes/auth.py', 'r') as f:
            content = f.read()
        
        # The requests.get call must NOT have verify=False
        # It should either have verify=True (explicit) or no verify parameter (defaults to True)
        
        # Check for patterns that would disable SSL verification
        assert 'verify=False' not in content, (
            "SSL verification must NOT be disabled. "
            "Found 'verify=False' in auth.py - this is a security vulnerability."
        )
        assert 'verify = False' not in content, (
            "SSL verification must NOT be disabled. "
            "Found 'verify = False' in auth.py - this is a security vulnerability."
        )

    def test_config_ssl_verification_setting_exists(self):
        """Test that config has SSL verification setting.
        
        The configuration should have a setting to control SSL verification
        for the Synology API connection.
        """
        with open('backend/app/core/config.py', 'r') as f:
            content = f.read()
        
        # Config should have a setting for SSL verification
        assert 'verify_ssl' in content.lower() or 'ssl_verify' in content.lower() or 'verify' in content, (
            "Configuration should have SSL verification setting. "
            "Add APP_SYNOLOGY_SSL_VERIFY environment variable support."
        )

    def test_no_debug_ssl_disable_in_production(self):
        """Test that there's no debug code that can disable SSL verification.
        
        There should be no code paths that disable SSL verification based on
        debug flags or environment variables in production.
        """
        with open('backend/app/api/routes/auth.py', 'r') as f:
            content = f.read()
        
        # Check for dangerous patterns
        dangerous_patterns = [
            'verify=False',
            'verify = False',
            'verify=False,',
            'verify = False,',
        ]
        
        for pattern in dangerous_patterns:
            assert pattern not in content, (
                f"Found dangerous SSL disable pattern: '{pattern}'. "
                "SSL verification must always be enabled."
            )


class TestSSLVerificationConfiguration:
    """Test SSL verification configuration options."""

    def test_environment_variable_for_ssl_verify(self):
        """Test that SSL verification can be configured via environment variable.
        
        There should be an environment variable (e.g., APP_SYNOLOGY_SSL_VERIFY)
        to control SSL certificate verification for the Synology API.
        """
        with open('backend/app/core/config.py', 'r') as f:
            content = f.read()
        
        # Check for environment variable configuration for SSL verify
        import re
        
        # Look for patterns like os.getenv('...SSL_VERIFY'...)
        ssl_verify_pattern = r"os\.getenv\(['\"]\w*SSL\w*VERIFY\w*['\"]"
        matches = re.findall(ssl_verify_pattern, content, re.IGNORECASE)
        
        assert len(matches) > 0, (
            "Should have an environment variable to configure SSL verification. "
            "Expected pattern like os.getenv('APP_SYNOLOGY_SSL_VERIFY')"
        )

    def test_requests_call_uses_config_for_verify(self):
        """Test that requests call uses the config value for verify parameter.
        
        The requests.get call to Synology API should use the configured
        SSL verification setting from config, not a hardcoded value.
        """
        with open('backend/app/api/routes/auth.py', 'r') as f:
            content = f.read()
        
        # The requests.get should reference a settings or config attribute for verify
        # e.g., settings.synology_ssl_verify or similar
        
        import re
        
        # Look for patterns where verify parameter uses a variable
        verify_pattern = r"verify\s*=\s*(?!False|True)"
        matches = re.findall(verify_pattern, content)
        
        # If there are no matches, verify is either not set (defaults to True) 
        # or hardcoded to True/False. We need to ensure it's using a config variable.
        
        # Check if there's any verify parameter at all
        has_verify_param = 'verify=' in content or 'verify =' in content
        
        # If verify parameter exists, it should use a config variable
        if has_verify_param:
            # Look for config/setting references near verify
            lines = content.split('\n')
            for i, line in enumerate(lines):
                if 'verify' in line.lower() and '=' in line:
                    # Check if it's using a config variable
                    if 'settings.' in line or 'config.' in line or 'get_settings()' in line:
                        pass  # Good - using config
                    else:
                        # Check if it's explicitly True or False
                        stripped = line.strip()
                        if 'verify=True' not in stripped and 'verify = True' not in stripped:
                            pytest.fail(
                                f"SSL verify parameter should use config value, not hardcoded. "
                                f"Found: {stripped}"
                            )
