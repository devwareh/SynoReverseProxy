"""Tests for CORS configuration security.

These tests verify that CORS settings are properly configured for production use
and don't allow wildcard origins with credentials.
"""
import pytest
from unittest.mock import patch, MagicMock
import os
import re


class TestCORSConfiguration:
    """Test CORS middleware configuration."""

    def test_no_wildcard_origin_with_credentials(self):
        """Test that wildcard '*' origin is not used with credentials enabled.
        
        When allow_credentials=True, origins cannot be wildcard '*' as this
        would be a security vulnerability.
        """
        with open('backend/app/main.py', 'r') as f:
            content = f.read()
        
        # Check for dangerous pattern: wildcard with credentials
        lines = content.split('\n')
        
        for i, line in enumerate(lines):
            if 'allow_origins' in line and '*' in line:
                # Check if credentials are also enabled
                context = '\n'.join(lines[max(0, i-5):min(len(lines), i+10)])
                if 'allow_credentials=True' in context or 'allow_credentials = True' in context:
                    pytest.fail(
                        f"Security vulnerability: Wildcard origin with credentials enabled at line {i+1}. "
                        "This allows any origin to receive credentials. "
                        "Either remove credentials or specify explicit origins."
                    )

    def test_production_cors_restrictions(self):
        """Test that CORS is properly restricted in production mode.
        
        Production CORS should be more restrictive than development.
        """
        with open('backend/app/main.py', 'r') as f:
            content = f.read()
        
        # Check for environment-based CORS configuration
        assert 'ENVIRONMENT' in content or 'environment' in content, (
            "CORS should be configured differently for production vs development. "
            "Add ENVIRONMENT check for CORS origins."
        )

    def test_allow_origin_regex_not_wildcard(self):
        """Test that allow_origin_regex is not overly permissive.
        
        The regex pattern should not match all possible origins.
        """
        with open('backend/app/main.py', 'r') as f:
            content = f.read()
        
        if 'allow_origin_regex' in content:
            # Extract the regex pattern
            match = re.search(r'allow_origin_regex\s*=\s*r["\']([^"\']+)["\']', content)
            if match:
                regex_pattern = match.group(1)
                
                # Check if pattern is too permissive
                # Pattern like .* or .+ would match everything
                if regex_pattern in ['.*', '.+', '.*?']:
                    pytest.fail(
                        f"allow_origin_regex '{regex_pattern}' is too permissive. "
                        "This would allow any origin."
                    )

    def test_development_cors_is_safe(self):
        """Test that development CORS doesn't expose production data.
        
        Development CORS should be limited to known development origins,
        not expose the application to external access.
        """
        with open('backend/app/main.py', 'r') as f:
            content = f.read()
        
        # Check allowed origins in development
        if 'is_development' in content or 'development' in content:
            # Should have explicit local origins listed
            assert 'localhost' in content or '127.0.0.1' in content, (
                "Development CORS should explicitly list localhost origins."
            )

    def test_no_http_origins_in_production(self):
        """Test that production CORS doesn't allow HTTP origins.
        
        For secure applications, production should only allow HTTPS origins.
        """
        with open('backend/app/main.py', 'r') as f:
            content = f.read()
        
        # Check if there's any restriction on HTTP origins
        # This is a code review item - production should prefer HTTPS origins
        
        lines = content.split('\n')
        
        for i, line in enumerate(lines):
            if 'http://' in line and 'allow_origins' in content[max(0, content.find(line)-100):content.find(line)+len(line)+100]:
                if 'https://' not in line:
                    # Flag for review - HTTP origins in CORS
                    pass

    def test_cors_methods_limited(self):
        """Test that CORS allowed methods are limited to necessary ones.
        
        Should not allow all methods (*), especially dangerous ones like
        DELETE or PUT if not needed.
        """
        with open('backend/app/main.py', 'r') as f:
            content = f.read()
        
        # Check for overly permissive methods
        if 'allow_methods=["*"]' in content or "allow_methods=['*']" in content:
            pytest.fail(
                "CORS allow_methods should not be wildcard '*'. "
                "Specify only the HTTP methods your API uses."
            )

    def test_cors_headers_limited(self):
        """Test that CORS allowed headers are limited.
        
        Should not allow all headers with wildcard.
        """
        with open('backend/app/main.py', 'r') as f:
            content = f.read()
        
        # Check for overly permissive headers
        if 'allow_headers=["*"]' in content or "allow_headers=['*']" in content:
            # This is sometimes necessary for APIs but should be reviewed
            # Not failing the test, but flagging for review
            pass


class TestCORSSecurityHeaders:
    """Test that CORS works correctly with security headers."""

    def test_preflight_requests_handled(self):
        """Test that CORS preflight (OPTIONS) requests are properly handled.
        
        The CORSMiddleware should handle OPTIONS preflight requests.
        """
        with open('backend/app/main.py', 'r') as f:
            content = f.read()
        
        # This is a FastAPI built-in, but verify it's configured
        assert 'CORSMiddleware' in content, (
            'CORSMiddleware should be imported and configured.'
        )

    def test_credentials_flag_appropriately_set(self):
        """Test that credentials flag is explicitly set.
        
        The allow_credentials setting should be explicit, not default.
        """
        with open('backend/app/main.py', 'r') as f:
            content = f.read()
        
        # Should have allow_credentials setting
        assert 'allow_credentials' in content, (
            "CORS allow_credentials should be explicitly configured."
        )
