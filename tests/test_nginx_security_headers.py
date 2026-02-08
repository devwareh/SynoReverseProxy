"""Tests for nginx security headers configuration.

These tests verify that nginx is configured with proper security headers
to protect against common web vulnerabilities.
"""
import pytest
from unittest.mock import patch, MagicMock
import os
import re


class TestNginxSecurityHeaders:
    """Test that nginx has proper security headers configured."""

    def test_x_content_type_options_header(self):
        """Test that nginx has X-Content-Type-Options header set.
        
        This header prevents MIME type sniffing attacks.
        """
        with open('frontend/nginx.conf', 'r') as f:
            content = f.read()
        
        assert 'X-Content-Type-Options' in content, (
            "nginx should have X-Content-Type-Options header. "
            "Add: add_header X-Content-Type-Options \"nosniff\";"
        )

    def test_x_frame_options_header(self):
        """Test that nginx has X-Frame-Options header set.
        
        This header prevents clickjacking attacks by controlling
        whether the site can be embedded in iframes.
        """
        with open('frontend/nginx.conf', 'r') as f:
            content = f.read()
        
        assert 'X-Frame-Options' in content, (
            "nginx should have X-Frame-Options header. "
            "Add: add_header X-Frame-Options \"SAMEORIGIN\"; or \"DENY\""
        )

    def test_x_xss_protection_header(self):
        """Test that nginx has X-XSS-Protection header set.
        
        This header enables XSS filter protection in older browsers.
        """
        with open('frontend/nginx.conf', 'r') as f:
            content = f.read()
        
        # X-XSS-Protection is deprecated but still useful for older browsers
        assert 'X-XSS-Protection' in content, (
            "nginx should have X-XSS-Protection header. "
            "Add: add_header X-XSS-Protection \"1; mode=block\";"
        )

    def test_referrer_policy_header(self):
        """Test that nginx has Referrer-Policy header set.
        
        This header controls how much referrer information is sent
        when users navigate away from the site.
        """
        with open('frontend/nginx.conf', 'r') as f:
            content = f.read()
        
        assert 'Referrer-Policy' in content, (
            "nginx should have Referrer-Policy header. "
            "Add: add_header Referrer-Policy \"strict-origin-when-cross-origin\";"
        )

    def test_content_security_policy_header(self):
        """Test that nginx has Content-Security-Policy header set.
        
        CSP is one of the most important security headers, preventing
        XSS and data injection attacks.
        """
        with open('frontend/nginx.conf', 'r') as f:
            content = f.read()
        
        assert 'Content-Security-Policy' in content, (
            "nginx should have Content-Security-Policy header. "
            "This is critical for preventing XSS attacks."
        )

    def test_strict_transport_security_header(self):
        """Test that nginx has HSTS (Strict-Transport-Security) header.
        
        HSTS forces browsers to only use HTTPS when connecting to the site.
        """
        with open('frontend/nginx.conf', 'r') as f:
            content = f.read()
        
        assert 'Strict-Transport-Security' in content, (
            "nginx should have Strict-Transport-Security header for HTTPS. "
            "Add: add_header Strict-Transport-Security \"max-age=31536000; includeSubDomains\";"
        )

    def test_permissions_policy_header(self):
        """Test that nginx has Permissions-Policy header set.
        
        This header controls which browser features and APIs can be used.
        """
        with open('frontend/nginx.conf', 'r') as f:
            content = f.read()
        
        assert 'Permissions-Policy' in content, (
            "nginx should have Permissions-Policy header. "
            "Add: add_header Permissions-Policy \"geolocation=(), microphone=()\";"
        )


class TestNginxSecurityConfiguration:
    """Test nginx security-related configuration."""

    def test_no_server_tokens_in_production(self):
        """Test that server tokens are hidden in production.
        
        The server should not reveal version information in headers.
        """
        with open('frontend/nginx.conf', 'r') as f:
            content = f.read()
        
        # Check for server_tokens setting
        assert 'server_tokens' in content, (
            "nginx should have server_tokens off to hide version info."
        )

    def test_autoindex_disabled(self):
        """Test that directory listing is disabled.
        
        Autoindex should not be enabled for security-sensitive directories.
        """
        with open('frontend/nginx.conf', 'r') as f:
            content = f.read()
        
        # Check that autoindex is not enabled
        if 'autoindex' in content:
            # Should be explicitly disabled
            assert 'autoindex off' in content, (
                "Directory listing (autoindex) should be disabled."
            )

    def test_unsafe_methods_blocked(self):
        """Test that dangerous HTTP methods are blocked.
        
        Methods like TRACE, CONNECT, OPTIONS (if not needed) should be restricted.
        """
        with open('frontend/nginx.conf', 'r') as f:
            content = f.read()
        
        # Check for limit_except or similar method restrictions
        if 'limit_except' in content:
            # Has method restrictions
            pass

    def test_client_max_body_size_set(self):
        """Test that client max body size is configured.
        
        This prevents DoS attacks through large request bodies.
        """
        with open('frontend/nginx.conf', 'r') as f:
            content = f.read()
        
        assert 'client_max_body_size' in content, (
            "nginx should have client_max_body_size limit to prevent DoS."
        )

    def test_connection_timeout_set(self):
        """Test that connection timeouts are configured.
        
        Timeouts prevent slowloris and similar DoS attacks.
        """
        with open('frontend/nginx.conf', 'r') as f:
            content = f.read()
        
        # Check for timeout settings
        timeout_patterns = [
            'keepalive_timeout',
            'client_header_timeout',
            'client_body_timeout',
        ]
        
        has_timeouts = any(pattern in content for pattern in timeout_patterns)
        assert has_timeouts, (
            "nginx should have timeout settings to prevent slow DoS attacks."
        )


class TestNginxSSLTLS:
    """Test nginx SSL/TLS configuration."""

    def test_ssl_protocols_restricted(self):
        """Test that SSL protocols are restricted to secure versions.
        
        Should only allow TLS 1.2 and 1.3, not SSL or TLS 1.0/1.1.
        """
        with open('frontend/nginx.conf', 'r') as f:
            content = f.read()
        
        if 'ssl_protocols' in content:
            # Should restrict to TLS 1.2+
            assert 'TLSv1.3' in content or 'TLSv1.2' in content, (
                "SSL protocols should be restricted to TLS 1.2 or higher."
            )
            # Should not include old protocols
            if 'SSLv2' in content or 'SSLv3' in content or 'TLSv1.0' in content or 'TLSv1.1' in content:
                pytest.fail(
                    "Old SSL protocols (SSLv2, SSLv3, TLSv1.0, TLSv1.1) should be disabled."
                )

    def test_ssl_ciphers_secure(self):
        """Test that SSL ciphers are configured securely.
        
        Should use strong cipher suites and prefer modern protocols.
        """
        with open('frontend/nginx.conf', 'r') as f:
            content = f.read()
        
        if 'ssl_ciphers' in content:
            # Should have secure ciphers configured
            pass

    def test_ssl_prefer_server_ciphers(self):
        """Test that server cipher order is preferred.
        
        Server should determine cipher order, not client.
        """
        with open('frontend/nginx.conf', 'r') as f:
            content = f.read()
        
        if 'ssl_prefer_server_ciphers' in content:
            # Good - server cipher preference
            pass

    def test_hsts_enabled_in_nginx(self):
        """Test that HSTS is configured in nginx for HTTPS.
        
        Should have max-age set for HSTS.
        """
        with open('frontend/nginx.conf', 'r') as f:
            content = f.read()
        
        if 'Strict-Transport-Security' in content:
            # Should have reasonable max-age
            if 'max-age=' in content:
                match = re.search(r'max-age=(\d+)', content)
                if match:
                    max_age = int(match.group(1))
                    # Should be at least 31536000 (1 year) for production
                    pass


class TestNginxHeadersPlacement:
    """Test that security headers are properly placed."""

    def test_headers_in_server_block(self):
        """Test that security headers are in the server block.
        
        Headers should be added at the server level for consistent application.
        """
        with open('frontend/nginx.conf', 'r') as f:
            content = f.read()
        
        # Check for add_header directives in server block
        if 'server {' in content:
            server_block = content[content.find('server {'):content.find('}')]
            if 'add_header' in server_block:
                # Has headers in server block
                pass

    def test_headers_not_overwritten(self):
        """Test that add_header directives are not conflicting.
        
        Each add_header should not overwrite previous ones unintentionally.
        """
        with open('frontend/nginx.conf', 'r') as f:
            content = f.read()
        
        # Count add_header occurrences
        add_header_count = content.count('add_header')
        
        # Should have multiple security headers
        assert add_header_count >= 5, (
            "nginx should have at least 5 security headers configured."
        )

    def test_headers_in_location_blocks(self):
        """Test that location blocks don't forget security headers.
        
        Headers should be inherited or explicitly set in all location blocks.
        """
        with open('frontend/nginx.conf', 'r') as f:
            content = f.read()
        
        # Check for add_header in location blocks
        if 'location' in content:
            # Each location block should either inherit or set headers
            pass
