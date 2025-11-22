#!/bin/bash

# Test script for duplicate checking in import endpoint
# Usage: ./samples/test-import-duplicates.sh [BACKEND_URL]
# Default: http://localhost:18888

BACKEND_URL="${1:-http://localhost:18888}"
API_URL="${BACKEND_URL}/rules"

echo "Testing Import Duplicate Detection"
echo "Backend URL: ${BACKEND_URL}"
echo ""

# Check if backend is accessible
if ! curl -s -f "${BACKEND_URL}/" > /dev/null 2>&1; then
    echo "ERROR: Backend not accessible at ${BACKEND_URL}"
    echo "Trying common ports..."
    for port in 8000 18888 3000; do
        test_url="http://localhost:${port}"
        if curl -s -f "${test_url}/" > /dev/null 2>&1; then
            response=$(curl -s "${test_url}/" | head -1)
            if echo "$response" | grep -q "Synology Reverse Proxy API"; then
                echo "Found backend at ${test_url}"
                BACKEND_URL="${test_url}"
                API_URL="${BACKEND_URL}/rules"
                break
            fi
        fi
    done
    if ! curl -s -f "${BACKEND_URL}/" > /dev/null 2>&1; then
        echo "ERROR: Could not find backend. Please specify correct URL:"
        echo "  ./samples/test-import-duplicates.sh http://localhost:PORT"
        exit 1
    fi
fi

echo "Using backend: ${BACKEND_URL}"
echo ""

# Test 1: First import - should create rules
echo "=== Test 1: First Import (should create) ==="
cat > /tmp/test-rules-1.json << 'EOF'
{
  "rules": [
    {
      "description": "Test Rule 1",
      "backend": {
        "fqdn": "localhost",
        "port": 5000,
        "protocol": 0
      },
      "frontend": {
        "fqdn": "test1.example.com",
        "port": 443,
        "protocol": 1,
        "https": {
          "hsts": false
        },
        "acl": null
      },
      "customize_headers": [],
      "proxy_connect_timeout": 60,
      "proxy_read_timeout": 60,
      "proxy_send_timeout": 60,
      "proxy_http_version": 1,
      "proxy_intercept_errors": false
    }
  ]
}
EOF

echo "Importing first rule..."
response=$(curl -s -X POST "${API_URL}/import" \
  -H "Content-Type: application/json" \
  -d @/tmp/test-rules-1.json)
echo "$response" | jq '.' 2>/dev/null || echo "$response"

echo ""
echo ""

# Test 2: Import exact duplicate - should skip
echo "=== Test 2: Exact Duplicate (should skip) ==="
echo "Importing same rule again (exact duplicate)..."
response=$(curl -s -X POST "${API_URL}/import" \
  -H "Content-Type: application/json" \
  -d @/tmp/test-rules-1.json)
echo "$response" | jq '.' 2>/dev/null || echo "$response"

echo ""
echo ""

# Test 3: Import conflict (same frontend, different backend) - should skip
echo "=== Test 3: Conflict (same frontend FQDN+port, different backend) ==="
cat > /tmp/test-rules-2.json << 'EOF'
{
  "rules": [
    {
      "description": "Test Rule 1 - Different Backend",
      "backend": {
        "fqdn": "192.168.1.100",
        "port": 8080,
        "protocol": 0
      },
      "frontend": {
        "fqdn": "test1.example.com",
        "port": 443,
        "protocol": 1,
        "https": {
          "hsts": false
        },
        "acl": null
      },
      "customize_headers": [],
      "proxy_connect_timeout": 60,
      "proxy_read_timeout": 60,
      "proxy_send_timeout": 60,
      "proxy_http_version": 1,
      "proxy_intercept_errors": false
    }
  ]
}
EOF

echo "Importing rule with same frontend but different backend..."
response=$(curl -s -X POST "${API_URL}/import" \
  -H "Content-Type: application/json" \
  -d @/tmp/test-rules-2.json)
echo "$response" | jq '.' 2>/dev/null || echo "$response"

echo ""
echo ""

# Test 4: Mixed import (new + duplicate) - should create new, skip duplicate
echo "=== Test 4: Mixed Import (new rule + duplicate) ==="
cat > /tmp/test-rules-3.json << 'EOF'
{
  "rules": [
    {
      "description": "Test Rule 1",
      "backend": {
        "fqdn": "localhost",
        "port": 5000,
        "protocol": 0
      },
      "frontend": {
        "fqdn": "test1.example.com",
        "port": 443,
        "protocol": 1,
        "https": {
          "hsts": false
        },
        "acl": null
      },
      "customize_headers": [],
      "proxy_connect_timeout": 60,
      "proxy_read_timeout": 60,
      "proxy_send_timeout": 60,
      "proxy_http_version": 1,
      "proxy_intercept_errors": false
    },
    {
      "description": "New Rule 2",
      "backend": {
        "fqdn": "localhost",
        "port": 3000,
        "protocol": 0
      },
      "frontend": {
        "fqdn": "test2.example.com",
        "port": 443,
        "protocol": 1,
        "https": {
          "hsts": true
        },
        "acl": null
      },
      "customize_headers": [
        {
          "name": "X-Forwarded-For",
          "value": "$remote_addr"
        }
      ],
      "proxy_connect_timeout": 60,
      "proxy_read_timeout": 60,
      "proxy_send_timeout": 60,
      "proxy_http_version": 1,
      "proxy_intercept_errors": false
    }
  ]
}
EOF

echo "Importing mixed rules (1 duplicate + 1 new)..."
response=$(curl -s -X POST "${API_URL}/import" \
  -H "Content-Type: application/json" \
  -d @/tmp/test-rules-3.json)
echo "$response" | jq '.' 2>/dev/null || echo "$response"

echo ""
echo ""

# Test 5: Export to see current state
echo "=== Test 5: Export Current Rules ==="
echo "Current rules in system:"
response=$(curl -s -X GET "${API_URL}/export")
echo "$response" | jq '.count, .rules[] | {description, frontend: .frontend.fqdn, port: .frontend.port}' 2>/dev/null || echo "$response"

echo ""
echo "=== Testing Complete ==="
echo ""
echo "Expected Results:"
echo "- Test 1: created=1, skipped=0"
echo "- Test 2: created=0, skipped=1 (exact_duplicate)"
echo "- Test 3: created=0, skipped=1 (conflict)"
echo "- Test 4: created=1, skipped=1 (new rule created, duplicate skipped)"

