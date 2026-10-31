from pathlib import Path
from google import genai

env = Path(__file__).resolve().parents[1] / ".env"
key = ""
for line in env.read_text(encoding="utf-8").splitlines():
    if line.startswith("GEMINI_API_KEY="):
        key = line.split("=", 1)[1].strip()
        break

client = genai.Client(api_key=key)
candidates = [
    "gemini-3.8-flash",
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite",
    "gemini-2.5-flash-lite",
    "gemini-flash-lite-latest",
    "gemini-3-flash-preview",
]
for model in candidates:
    try:
        r = client.models.generate_content(model=model, contents="Reply with exactly: OK")
        print("OK", model, "->", (r.text or "")[:80])
    except Exception as e:
        print("FAIL", model, "->", str(e).replace("\n", " ")[:240])
