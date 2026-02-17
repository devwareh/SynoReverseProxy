"""Tests for Docker healthcheck configuration.

These tests verify that healthcheck commands are properly configured
to avoid shell variable expansion issues.
"""
import re


class TestDockerfileHealthcheck:
    """Test that Dockerfile HEALTHCHECK is properly configured."""

    def test_dockerfile_healthcheck_no_double_dollar(self):
        """Test that frontend Dockerfile HEALTHCHECK does not use $$ pattern.
        
        The $$ pattern in Dockerfile HEALTHCHECK causes the shell to expand
        it as the process ID instead of escaping for variable substitution.
        Docker does not perform variable substitution on HEALTHCHECK CMD,
        so we should use single $ for shell expansion.
        """
        with open('frontend/Dockerfile', 'r') as f:
            content = f.read()
        
        # Find HEALTHCHECK line
        healthcheck_pattern = r'HEALTHCHECK.*?CMD.*?(?=\n[A-Z]|\Z)'
        matches = re.findall(healthcheck_pattern, content, re.DOTALL)
        
        assert len(matches) > 0, "No HEALTHCHECK found in frontend/Dockerfile"
        
        healthcheck_cmd = matches[0]
        
        # Check that it doesn't use $$ pattern (which expands to PID in shell)
        assert '$$' not in healthcheck_cmd, (
            "HEALTHCHECK should not use $$ pattern. "
            "In Dockerfile HEALTHCHECK CMD, $$ expands to shell PID, not variable escape. "
            "Use single $ for shell variable expansion: ${NGINX_PORT:-8889}"
        )
    
    def test_dockerfile_healthcheck_uses_nginx_port(self):
        """Test that Dockerfile HEALTHCHECK references NGINX_PORT variable."""
        with open('frontend/Dockerfile', 'r') as f:
            content = f.read()
        
        # Find HEALTHCHECK line
        healthcheck_pattern = r'HEALTHCHECK.*?CMD.*?(?=\n[A-Z]|\Z)'
        matches = re.findall(healthcheck_pattern, content, re.DOTALL)
        
        assert len(matches) > 0, "No HEALTHCHECK found in frontend/Dockerfile"
        
        healthcheck_cmd = matches[0]
        
        # Check that it references NGINX_PORT with shell expansion syntax
        assert 'NGINX_PORT' in healthcheck_cmd, (
            "HEALTHCHECK should reference NGINX_PORT variable"
        )
        
        # Check for proper shell expansion syntax ${VAR:-default}
        assert re.search(r'\$\{NGINX_PORT:-\d+\}', healthcheck_cmd), (
            "HEALTHCHECK should use shell parameter expansion syntax: ${NGINX_PORT:-8889}"
        )
    
    def test_dockerfile_healthcheck_wget_command(self):
        """Test that Dockerfile HEALTHCHECK uses wget with correct options."""
        with open('frontend/Dockerfile', 'r') as f:
            content = f.read()
        
        # Find HEALTHCHECK line
        healthcheck_pattern = r'HEALTHCHECK.*?CMD.*?(?=\n[A-Z]|\Z)'
        matches = re.findall(healthcheck_pattern, content, re.DOTALL)
        
        assert len(matches) > 0, "No HEALTHCHECK found in frontend/Dockerfile"
        
        healthcheck_cmd = matches[0]
        
        # Check wget is used
        assert 'wget' in healthcheck_cmd, "HEALTHCHECK should use wget"
        
        # Check for proper localhost reference
        assert '127.0.0.1' in healthcheck_cmd, (
            "HEALTHCHECK should check localhost (127.0.0.1)"
        )


class TestDockerComposeHealthcheck:
    """Test that docker-compose.yml healthcheck is properly configured."""

    def test_compose_healthcheck_uses_double_dollar(self):
        """Test that docker-compose.yml frontend healthcheck uses $$ escape.
        
        In docker-compose.yml, $ triggers variable substitution by Compose.
        We need $$ to escape it so the shell receives ${NGINX_PORT:-8889}
        at runtime, not at compose time.
        """
        with open('docker-compose.yml', 'r') as f:
            content = f.read()
        
        # Find frontend service healthcheck
        # Look for frontend service section
        frontend_section = re.search(
            r'frontend:.*?(?=\n\w+:|$)',
            content,
            re.DOTALL
        )
        
        assert frontend_section, "No frontend service found in docker-compose.yml"
        
        frontend_content = frontend_section.group(0)
        
        # Check if healthcheck exists
        if 'healthcheck:' in frontend_content:
            # Extract healthcheck section
            healthcheck_match = re.search(
                r'healthcheck:.*?test:.*?\n.*?(?=\n\s{0,4}\w+:|$)',
                frontend_content,
                re.DOTALL
            )
            
            if healthcheck_match:
                healthcheck_content = healthcheck_match.group(0)
                
                # In docker-compose, we need $$ to escape the $ for shell expansion
                assert '$$' in healthcheck_content, (
                    "docker-compose.yml healthcheck should use $$ to escape $ "
                    "so Compose doesn't substitute it, and shell expands it at runtime"
                )
                
                # Should reference NGINX_PORT
                assert 'NGINX_PORT' in healthcheck_content, (
                    "docker-compose.yml healthcheck should reference NGINX_PORT"
                )
    
    def test_compose_frontend_nginx_port_env(self):
        """Test that docker-compose.yml sets NGINX_PORT environment variable."""
        with open('docker-compose.yml', 'r') as f:
            content = f.read()
        
        # Find frontend service section
        frontend_section = re.search(
            r'frontend:.*?(?=\n\w+:|$)',
            content,
            re.DOTALL
        )
        
        assert frontend_section, "No frontend service found in docker-compose.yml"
        
        frontend_content = frontend_section.group(0)
        
        # Check that NGINX_PORT is set in environment
        assert 'NGINX_PORT' in frontend_content, (
            "frontend service should have NGINX_PORT in environment variables"
        )


class TestBackendHealthcheck:
    """Test that backend healthcheck is properly configured."""

    def test_backend_dockerfile_healthcheck_no_double_dollar(self):
        """Test that backend Dockerfile HEALTHCHECK does not use $$ pattern."""
        with open('backend/Dockerfile', 'r') as f:
            content = f.read()
        
        # Find HEALTHCHECK line
        healthcheck_pattern = r'HEALTHCHECK.*?CMD.*?(?=\n[A-Z]|\Z)'
        matches = re.findall(healthcheck_pattern, content, re.DOTALL)
        
        if len(matches) > 0:
            healthcheck_cmd = matches[0]
            
            # If it uses BACKEND_PORT, should not use $$
            if 'BACKEND_PORT' in healthcheck_cmd:
                assert '$$' not in healthcheck_cmd, (
                    "Backend HEALTHCHECK should not use $$ pattern. "
                    "Use single $ for shell variable expansion."
                )
