# AGENTS.md

## Cursor Cloud specific instructions

### Overview
ChatPsychiatrist is an AI-powered mental health chatbot built on FastChat. It's a Python package (`fschat`) installable via `pip install -e ".[dev]"`.

### Services (Distributed Serving Architecture)
The serving stack has three services that must be launched **in order**:

1. **Controller** (port 21001): `python3 -m fastchat.serve.controller --host 0.0.0.0 --port 21001`
2. **Model Worker** (port 21002): `python3 -m fastchat.serve.model_worker --model-path <PATH> --port 21002` — **requires GPU + model weights (~14GB VRAM for 7B model)**
3. **Gradio Web UI** (port 7860): `python3 -m fastchat.serve.gradio_web_server --host 0.0.0.0 --port 7860 --controller-url http://localhost:21001`
4. **OpenAI API Server** (port 8000): `python3 -m fastchat.serve.openai_api_server --host 0.0.0.0 --port 8000 --controller-address http://localhost:21001`

In a **CPU-only environment** (no GPU), the Controller, Gradio Web Server, and OpenAI API Server all start and respond correctly. The Model Worker requires a GPU and model weights to serve inference — without it, the API returns empty model lists and the chat UI returns errors on message send. This is expected.

### Linting
- **black** (23.3.0): `black --check fastchat/` for formatting checks
- **pylint**: `pylint fastchat/` — the repo pins pylint 2.8.2 in `pyproject.toml` but that version is incompatible with Python 3.12. Install `pylint>=2.17` at runtime.
- The `format.sh` script runs both black and pylint, but references `origin/main` which doesn't exist in this repo (branch is `master`).

### Gotchas
- `requirements.txt` pins specific CUDA-dependent packages (torch==1.13.1+cu117, flash_attn, xformers, vllm, etc.) that won't install on CPU. Use `pip install -e ".[dev]"` from `pyproject.toml` instead, which installs compatible versions.
- `pylint 2.8.2` (pinned in `[project.optional-dependencies]`) crashes on Python 3.12 due to `wrapt`/`astroid` incompatibility. Upgrade `pylint>=2.17` and its dependencies.
- `$HOME/.local/bin` must be on PATH for `black`, `pylint`, `uvicorn`, `gradio`, and other CLI tools installed by pip.
- There are no automated test suites runnable without GPU/models; `tests/test_cli.py` and `tests/test_openai_api.py` require live model workers.
