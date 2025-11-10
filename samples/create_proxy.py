import requests
import json

# WARNING: Replace with your actual values. Never commit real credentials!
NAS_URL = 'https://YOUR_NAS_IP:5001'
sid = '<your-sid>'  # Get this from authentication, never hardcode real session IDs
url = f"{NAS_URL}/webapi/query.cgi"

params = {
    "api": "SYNO.Core.AppPortal.ReverseProxy",
    "method": "create",
    "version": "1",
    "_sid": sid
}

entry_dict = {
    "description": "test-api-mock",
    "proxy_connect_timeout": 60,
    "proxy_read_timeout": 60,
    "proxy_send_timeout": 60,
    "proxy_http_version": 1,
    "proxy_intercept_errors": False,
    "frontend": {
        "acl": None,
        "fqdn": "mocktest.flnx.de",
        "port": 443,
        "protocol": 1,
        "https": {"hsts": False}
    },
    "backend": {
        "fqdn": "localhost",
        "port": 9999,
        "protocol": 0
    },
    "customize_headers": []
}

data = {
    "entry": json.dumps(entry_dict)  # serialize to JSON string!
}

response = requests.post(url, params=params, data=data, verify=False)
print(response.status_code)
print(response.text)