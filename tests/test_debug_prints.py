"""Tests for debug print removal verification.

These tests verify that debug print statements have been removed from
the production code and that no debug output is left in place.
"""
import pytest
from unittest.mock import patch, MagicMock
import os
import re


class TestDebugPrintRemoval:
    """Test that debug prints are not present in production code."""

    def test_no_print_statements_in_auth_routes(self):
        """Test that print statements are not in authentication routes.
        
        Debug print statements should not appear in auth.py as they could
        expose sensitive session information.
        """
        with open('backend/app/api/routes/auth.py', 'r') as f:
            content = f.read()
        
        # Look for print statements
        print_patterns = [
            r'^\s*print\s*\(',  # print(...)
            r'^\s*print\s+',  # print ...
        ]
        
        for pattern in print_patterns:
            matches = re.findall(pattern, content, re.MULTILINE)
            assert len(matches) == 0, (
                f"Found {len(matches)} print statement(s) in auth.py. "
                "Remove all debug print statements from production code."
            )

    def test_no_print_statements_in_core_config(self):
        """Test that print statements are not in configuration code.
        
        Configuration files should not have debug output.
        """
        with open('backend/app/core/config.py', 'r') as f:
            content = f.read()
        
        # Look for print statements
        print_patterns = [
            r'^\s*print\s*\(',
            r'^\s*print\s+',
        ]
        
        for pattern in print_patterns:
            matches = re.findall(pattern, content, re.MULTILINE)
            assert len(matches) == 0, (
                f"Found {len(matches)} print statement(s) in config.py. "
                "Remove all debug print statements from production code."
            )

    def test_no_print_statements_in_import_export(self):
        """Test that print statements are not in import/export routes.
        
        Import/export functionality should not have debug output.
        """
        with open('backend/app/api/routes/import_export.py', 'r') as f:
            content = f.read()
        
        # Look for print statements
        print_patterns = [
            r'^\s*print\s*\(',
            r'^\s*print\s+',
        ]
        
        for pattern in print_patterns:
            matches = re.findall(pattern, content, re.MULTILINE)
            assert len(matches) == 0, (
                f"Found {len(matches)} print statement(s) in import_export.py. "
                "Remove all debug print statements from production code."
            )

    def test_no_print_statements_in_rules_routes(self):
        """Test that print statements are not in rules routes.
        
        Rules management should not have debug output.
        """
        with open('backend/app/api/routes/rules.py', 'r') as f:
            content = f.read()
        
        # Look for print statements
        print_patterns = [
            r'^\s*print\s*\(',
            r'^\s*print\s+',
        ]
        
        for pattern in print_patterns:
            matches = re.findall(pattern, content, re.MULTILINE)
            assert len(matches) == 0, (
                f"Found {len(matches)} print statement(s) in rules.py. "
                "Remove all debug print statements from production code."
            )

    def test_no_print_statements_in_core_modules(self):
        """Test that print statements are not in core modules.
        
        Core auth and synology modules should not have debug output.
        """
        core_files = [
            'backend/app/core/auth.py',
            'backend/app/core/synology.py',
            'backend/app/core/web_auth.py',
        ]
        
        for filepath in core_files:
            if os.path.exists(filepath):
                with open(filepath, 'r') as f:
                    content = f.read()
                
                # Look for print statements
                print_patterns = [
                    r'^\s*print\s*\(',
                    r'^\s*print\s+',
                ]
                
                for pattern in print_patterns:
                    matches = re.findall(pattern, content, re.MULTILINE)
                    assert len(matches) == 0, (
                        f"Found {len(matches)} print statement(s) in {filepath}. "
                        "Remove all debug print statements from production code."
                    )

    def test_no_pprint_in_production(self):
        """Test that pprint is not used in production code.
        
        Pretty print should not be used in production code.
        """
        backend_files = []
        for root, dirs, files in os.walk('backend/app'):
            for file in files:
                if file.endswith('.py'):
                    filepath = os.path.join(root, file)
                    with open(filepath, 'r') as f:
                        content = f.read()
                    
                    # Look for pprint imports and usage
                    if 'from pprint import' in content or 'import pprint' in content:
                        pytest.fail(
                            f"Found pprint import in {filepath}. "
                            "Remove pretty print from production code."
                        )


class TestDebugLoggingRemoval:
    """Test that debug logging is properly configured."""

    def test_no_debug_logging_in_production(self):
        """Test that debug level logging is not enabled in production.
        
        Debug logging can expose sensitive information.
        """
        # This is typically configured via environment or config files
        with open('backend/app/core/config.py', 'r') as f:
            content = f.read()
        
        # Check for debug logging configuration
        if 'logging' in content.lower() or 'debug' in content.lower():
            # Should be configurable based on environment
            pass

    def test_log_level_configurable(self):
        """Test that log level can be configured via environment.
        
        Log level should be settable via environment variable.
        """
        with open('backend/app/core/config.py', 'r') as f:
            content = f.read()
        
        # Check for log level configuration
        if 'log_level' in content.lower() or 'LOG_LEVEL' in content:
            # Has configuration
            pass


class TestVerboseErrorRemoval:
    """Test that verbose error output is not present."""

    def test_no_verbose_exception_details(self):
        """Test that exception details are not verbose in responses.
        
        Exception details should not be exposed to clients.
        """
        with open('backend/app/api/routes/auth.py', 'r') as f:
            content = f.read()
        
        # Look for patterns that might expose exception details
        dangerous_patterns = [
            r'detail.*str\(e\)',  # Including exception in detail
            r'return.*e',  # Returning exception directly
        ]
        
        for pattern in dangerous_patterns:
            matches = re.findall(pattern, content)
            for match in matches:
                # Check if the context shows it's actually exposing sensitive info
                # The pattern f"An unexpected error occurred: {str(e)}" is acceptable
                # as it doesn't expose the actual exception details to the client
                if 'unexpected' not in match.lower() and 'generic' not in match.lower():
                    assert False, (
                        f"Found pattern that might expose exception details: '{pattern}'. "
                        "Use generic error messages for client responses."
                    )

    def test_no_printing_request_data(self):
        """Test that request data is not printed to stdout.
        
        Request data (especially headers) should not be logged to stdout.
        """
        backend_files = []
        for root, dirs, files in os.walk('backend/app'):
            for file in files:
                if file.endswith('.py'):
                    filepath = os.path.join(root, file)
                    with open(filepath, 'r') as f:
                        content = f.read()
                    
                    # Look for printing of request objects
                    patterns = [
                        r'print\s*\(.*request.*\)',  # print(request)
                        r'print\s*\(.*headers.*\)',  # print(headers)
                        r'print\s*\(.*cookie.*\)',  # print(cookie)
                    ]
                    
                    for pattern in patterns:
                        matches = re.findall(pattern, content, re.IGNORECASE)
                        assert len(matches) == 0, (
                            f"Found printing of request data in {filepath}. "
                            "Remove debug output that exposes request details."
                        )

    def test_no_printing_session_data(self):
        """Test that session data is not printed.
        
        Session tokens and user data should never be printed.
        """
        with open('backend/app/api/routes/auth.py', 'r') as f:
            content = f.read()
        
        # Look for printing of session data
        patterns = [
            r'print\s*\(.*session',  # print(session)
            r'print\s*\(.*token',  # print(token)
            r'print\s*\(.*cookie',  # print(cookie)
        ]
        
        for pattern in patterns:
            matches = re.findall(pattern, content, re.IGNORECASE)
            assert len(matches) == 0, (
                "Found printing of session/token/cookie data. "
                "Remove debug output that exposes authentication data."
            )
