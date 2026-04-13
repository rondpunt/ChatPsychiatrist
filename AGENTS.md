# AGENTS.md

This file provides operating guidance for coding agents working in this repository.

## Project at a glance

- **Repository**: ChatPsychiatrist (built on FastChat)
- **Primary language**: Python
- **Packaging**: `pyproject.toml` (`fschat`)
- **Dependencies**: `requirements.txt`
- **Core code**: `fastchat/`
- **Tests**: `tests/`

## Environment setup

Use Python 3.8+ (as declared in `pyproject.toml`), then install dependencies:

```bash
pip3 install -r requirements.txt
```

## Common commands

### Run inference (CLI)

```bash
python3 -m fastchat.serve.cli --model-path PATH_TO_WEIGHTS_DIR
```

### Start web serving stack

```bash
# 1) controller
python3 -m fastchat.serve.controller

# 2) worker
python3 -m fastchat.serve.model_worker --model-path PATH_TO_WEIGHTS_DIR

# 3) web server
python3 -m fastchat.serve.gradio_web_server
```

### Formatting and linting

The repository includes `format.sh`, which enforces:

- `black==23.3.0`
- `pylint==2.8.2`

Run:

```bash
bash format.sh
```

## Code style expectations

- Keep changes targeted and minimal.
- Follow existing patterns in `fastchat/` rather than introducing new architecture.
- Prefer explicit, readable Python over clever one-liners.
- Add comments only when logic is non-obvious.

## Testing guidance

- Run focused tests for touched code under `tests/` when possible.
- For docs-only changes, tests are not required.
- For behavior changes, run the smallest meaningful test scope first, then expand if needed.

## Safety and data handling

- Do not commit model weights, large datasets, or generated artifacts.
- Avoid hardcoding credentials, tokens, or local file-system assumptions.
- Preserve existing user-authored edits; do not revert unrelated changes.

## Commit and PR guidance

- Use clear commit messages describing intent and scope.
- Keep PRs focused on a single logical change.
- Include a short validation note (what was checked, or why tests were skipped).

