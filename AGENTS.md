# AGENTS.md

## Cursor Cloud specific instructions

### Overview

ChatPsychiatrist is an AI mental health chatbot built on [FastChat](https://github.com/lm-sys/FastChat). It uses a 3-tier serving architecture: **Controller** (port 21001) → **Model Worker** (GPU, port 21002) → **OpenAI API Server** (port 8000), plus an optional **Gradio Web UI** (port 7860).

### Dependencies

Install with `pip install -e ".[dev]"` from the repo root. This installs the `fschat` package in editable mode plus dev tools (`black`, `pylint`). Ensure `$HOME/.local/bin` is on `PATH`.

### Lint

- **black**: `black --check fastchat/` (works on Python 3.12)
- **pylint**: pinned at 2.8.2, incompatible with Python 3.12 (`formatargspec` removed from `inspect`). Upgrade `pylint` + `astroid` if lint enforcement is needed.

### Running services (CPU-only, no model inference)

Start each in a separate terminal. Order matters: controller first, then API server and/or web UI.

```bash
python3 -m fastchat.serve.controller --host 0.0.0.0 --port 21001
python3 -m fastchat.serve.openai_api_server --host 0.0.0.0 --port 8000 --controller-address http://localhost:21001
python3 -m fastchat.serve.gradio_web_server --host 0.0.0.0 --port 7860 --controller-url http://localhost:21001
```

Without a GPU and model weights, the model list will be empty and chat requests will error, but the infrastructure itself is fully functional.

### Running services (with GPU)

Requires NVIDIA GPU with ~14 GB VRAM. After starting the controller, launch a model worker:

```bash
python3 -m fastchat.serve.model_worker --model-path <PATH_TO_WEIGHTS> --controller http://localhost:21001 --port 21002 --worker http://localhost:21002
```

Model weights: `EmoCareAI/ChatPsychiatrist` on HuggingFace.

### Health checks

```bash
curl -X POST http://localhost:21001/list_models        # Controller
curl http://localhost:8000/v1/models                    # OpenAI API
curl -o /dev/null -w "%{http_code}" http://localhost:7860/  # Gradio UI (expect 200)
```

### Tests

Tests live in `tests/`. They require a running serving stack with loaded models:
- `tests/test_openai_api.py` — tests OpenAI-compatible endpoints
- `tests/test_cli.py` — tests CLI chat interface

### Gotchas

- `pydantic` must stay at v1 (`<=2.0`). The codebase uses `pydantic.BaseSettings` which moved to `pydantic-settings` in v2.
- `requirements.txt` pins many specific versions (including CUDA-specific `torch==1.13.1+cu117`) that may conflict with the editable install. Use `pip install -e ".[dev]"` (from `pyproject.toml`) rather than `pip install -r requirements.txt` for dev setup.
- The Gradio web UI shows "NETWORK ERROR" when sending a message without a connected model worker — this is expected behavior, not a bug.
