# AGENTS.md

This file provides guidance for AI coding agents working on the **ChatPsychiatrist** repository.

## Project Overview

ChatPsychiatrist is a mental-health-focused conversational AI built on top of [FastChat](https://github.com/lm-sys/FastChat). It fine-tunes LLaMA-7B on **Psych8K**, an 8 187-sample counseling instruction dataset derived from real therapy transcripts. The codebase covers the full lifecycle: data processing, fine-tuning, serving (CLI, Web GUI, OpenAI-compatible API), and evaluation (LLM-as-judge with counseling-specific metrics).

## Repository Layout

```
fastchat/
  conversation.py        # Conversation template definitions
  constants.py           # Shared constants
  utils.py               # Shared utilities
  serve/                 # Inference servers (controller, model_worker, gradio, openai API)
  train/                 # Training scripts (full, LoRA, xformers, DeepSpeed variants)
  model/                 # Model adapters, delta/LoRA application, compression helpers
  llm_judge/             # LLM-as-judge evaluation pipeline (gen answers, judge, show results)
  modules/               # Optional quantization / attention modules
tests/                   # Integration tests for CLI and OpenAI API compatibility
scripts/                 # Shell helpers for training and PyPI upload
playground/              # DeepSpeed config examples
docs/                    # Evaluation metric definitions
assets/                  # Images used in README
llm-judge/               # Standalone judge sub-project (README only)
```

## Environment Setup

**Python** ≥ 3.8 is required. Install dependencies with:

```bash
pip install -r requirements.txt
# or editable install (recommended for development)
pip install -e ".[dev]"
```

Key pinned versions (from `pyproject.toml` dev extras):

| Tool    | Version  |
|---------|----------|
| black   | 23.3.0   |
| pylint  | 2.8.2    |

GPU inference requires CUDA. The model fits in ~14 GB VRAM on a single GPU.

## Development Workflow

### Formatting and Linting

Run the combined format + lint check before committing:

```bash
bash format.sh
```

- `format.sh --files <file> ...` — format specific files only
- `format.sh --all` — reformat the entire `fastchat/` package
- Without flags it reformats only files changed relative to `origin/main`

`black` enforces style; `pylint` enforces quality. Both must pass cleanly (no diff after formatting, no pylint errors) before a PR is ready.

### Running Tests

```bash
# CLI smoke test
python tests/test_cli.py

# OpenAI-compatible API tests (requires a running server; see tests/launch_openai_api_test_server.py)
python tests/test_openai_api.py
python tests/test_openai_langchain.py
```

### Training

```bash
# Fine-tune with LoRA (example)
bash scripts/train_lora.sh

# Full fine-tune (Vicuna recipe)
bash scripts/train_vicuna_7b.sh   # 7B
bash scripts/train_vicuna_13b.sh  # 13B
```

DeepSpeed stage-2 and stage-3 configs live in `playground/`.

### Evaluation (Counselling Bench)

```bash
python3 -m fastchat.llm_judge.gen_model_answer \
  --model-id chatpsychiatrist \
  --model-path PATH_TO_WEIGHTS_DIR \
  --bench-name counselling_bench

python3 -m fastchat.llm_judge.gen_judgment   # score with GPT-4 judge
python3 -m fastchat.llm_judge.show_result    # display aggregate scores
```

### Serving

```bash
# CLI
python3 -m fastchat.serve.cli --model-path PATH_TO_WEIGHTS_DIR

# Web GUI (three processes)
python3 -m fastchat.serve.controller
python3 -m fastchat.serve.model_worker --model-path PATH_TO_WEIGHTS_DIR
python3 -m fastchat.serve.gradio_web_server

# OpenAI-compatible REST API
python3 -m fastchat.serve.openai_api_server --host 0.0.0.0 --port 8000
```

## Code Style Guidelines

- All Python code must pass `black 23.3.0` formatting (line length 88, PEP 8-compliant).
- All Python code must pass `pylint 2.8.2` with the settings in `.pylintrc`.
- New modules should follow the existing `fastchat/` package structure.
- Avoid adding heavy new dependencies; prefer what is already in `requirements.txt`.
- Do not commit model weights or large binary files; use Hugging Face Hub for model artifacts.

## Pull Request Checklist

1. `bash format.sh` passes with no diff and no pylint errors.
2. Relevant tests in `tests/` pass.
3. New public functions/classes have docstrings.
4. If a new model adapter is added, register it in `fastchat/model/model_registry.py`.
5. Update `README.md` or `docs/` if user-facing behavior changes.
