import json
import urllib.request

BASE = "http://localhost:8001/api/v1"


def call(path, method="GET", data=None, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    body = None if data is None else json.dumps(data).encode()
    req = urllib.request.Request(BASE + path, data=body, headers=headers, method=method)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())


login = call("/auth/login", "POST", {"email": "owner@rajveerchinese.demo", "password": "vyapaarai123"})
token = login["access_token"]
locs = call("/google/locations", token=token)
print("LOCATIONS", len(locs), locs[0]["title"] if locs else None)
print("HAS_DESC", bool(locs and locs[0].get("description")))
print("SERVICES", locs[0].get("services") if locs else None)
opt = call(
    "/profile/optimize",
    "POST",
    {"location_id": locs[0]["id"], "focus": "description", "notes": "keep Vadjal local"},
    token=token,
)
print("MODEL", opt.get("_model_used"))
print("SOURCE", opt.get("source"))
print("TEXT", (opt.get("improved_text") or "")[:160])
