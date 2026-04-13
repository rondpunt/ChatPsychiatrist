"""
ChatPsychiatrist website server.
Serves the static website and proxies chat requests to the FastChat OpenAI-compatible API.
"""

import argparse
import json
import logging
from pathlib import Path

import httpx
import uvicorn
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

logger = logging.getLogger("website")
logging.basicConfig(level=logging.INFO)

app = FastAPI(title="ChatPsychiatrist Website")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

FASTCHAT_API_BASE = "http://localhost:8000"


@app.post("/api/chat")
async def chat(request: Request):
    """Proxy chat completions to the FastChat OpenAI-compatible API, with streaming."""
    body = await request.json()
    messages = body.get("messages", [])
    model = body.get("model", "")

    if not model:
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(f"{FASTCHAT_API_BASE}/v1/models", timeout=5)
                data = resp.json().get("data", [])
                if data:
                    model = data[0]["id"]
        except Exception:
            pass

    if not model:
        return {"error": "No model available. A model worker with GPU must be running."}

    payload = {
        "model": model,
        "messages": messages,
        "stream": True,
        "max_tokens": 512,
        "temperature": 0.7,
    }

    async def stream_response():
        async with httpx.AsyncClient() as client:
            async with client.stream(
                "POST",
                f"{FASTCHAT_API_BASE}/v1/chat/completions",
                json=payload,
                timeout=120,
            ) as resp:
                async for line in resp.aiter_lines():
                    if line.startswith("data: "):
                        chunk = line[6:]
                        if chunk.strip() == "[DONE]":
                            yield "data: [DONE]\n\n"
                            break
                        yield f"data: {chunk}\n\n"

    return StreamingResponse(stream_response(), media_type="text/event-stream")


@app.get("/api/models")
async def list_models():
    """List available models from the FastChat controller."""
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{FASTCHAT_API_BASE}/v1/models", timeout=5)
            return resp.json()
    except Exception as e:
        return {"object": "list", "data": [], "error": str(e)}


@app.get("/api/health")
async def health():
    """Health check for all backend services."""
    services = {}
    for name, url in [
        ("controller", "http://localhost:21001"),
        ("api_server", f"{FASTCHAT_API_BASE}/v1/models"),
    ]:
        try:
            async with httpx.AsyncClient() as client:
                if "controller" in name:
                    resp = await client.post(f"{url}/list_models", timeout=3)
                else:
                    resp = await client.get(url, timeout=3)
                services[name] = {"status": "ok", "code": resp.status_code}
        except Exception as e:
            services[name] = {"status": "error", "error": str(e)}

    return {"services": services}


WEBSITE_DIR = Path(__file__).parent
ASSETS_DIR = Path(__file__).parent.parent / "assets"

app.mount("/assets", StaticFiles(directory=str(ASSETS_DIR)), name="assets")
app.mount("/static", StaticFiles(directory=str(WEBSITE_DIR / "static")), name="static")


@app.get("/", response_class=HTMLResponse)
async def index():
    return (WEBSITE_DIR / "index.html").read_text()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=5000)
    args = parser.parse_args()
    uvicorn.run(app, host=args.host, port=args.port)
