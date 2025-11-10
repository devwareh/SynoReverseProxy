import requests

# WARNING: Replace with your actual NAS URL. Never commit real IPs!
NAS_URL = 'https://YOUR_NAS_IP:5001'
sid = '<your-sid>'   # optional if API requires sid, otherwise omit

url = f"{NAS_URL}/webapi/entry.cgi"
params = {
    "api":     "SYNO.API.Info",
    "version": "1",
    "method":  "query",
    "query":   "SYNO.Core.AppPortal.ReverseProxy"
}
if sid:
    params["_sid"] = sid

resp = requests.get(url, params=params, verify=False)
print(resp.status_code)
print(resp.text)
