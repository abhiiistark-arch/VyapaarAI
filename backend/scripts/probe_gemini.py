from pathlib import Path

from google import genai

env = Path(__file__).resolve().parents[1] / ".env"
key = ""
for line in env.read_text(encoding="utf-8").splitlines():
    if line.startswith("GEMINI_API_KEY="):
        key = line.split("=", 1)[1].strip()
        break

print("KEY_PREFIX", key[:8], "LEN", len(key))
client = genai.Client(api_key=key)

try:
    names = []
    for m in client.models.list():
        name = getattr(m, "name", "") or ""
        if "gemini" in name.lower() and "embed" not in name.lower():
            names.append(name)
    print("LISTED", names[:50])
except Exception as e:
    print("LIST_ERROR", type(e).__name__, str(e)[:300])

candidates = [
    "gemini-2.0-flash",
    "gemini-2.0-flash-001",
    "gemini-2.5-flash",
    "gemini-1.5-flash",
    "gemini-1.5-flash-latest",
    "gemini-flash-latest",
    "gemini-2.0-flash-lite",
    "gemini-pro-latest",
    "models/gemini-2.0-flash",
    "models/gemini-1.5-flash",
]

for model in candidates:
    try:
        r = client.models.generate_content(model=model, contents="Reply with exactly: OK")
        print("OK", model, "->", (r.text or "")[:80])
    except Exception as e:
        print("FAIL", model, "->", str(e).replace("\n", " ")[:220])
