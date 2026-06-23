# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Home Assistant custom integration that adds a full-screen sidebar panel ("Pyscrypt Manager") for listing, editing, and running Python scripts managed by the [pyscript](https://github.com/custom-components/pyscript) integration. It is a native sidebar app registered at `/pyscrypt-manager` — not a Lovelace card.

## Architecture

There are only two source files; nearly all logic lives in the JS panel.

- `custom_components/pyscrypt_manager/__init__.py` — integration setup. Registers the static JS path, the sidebar panel, and three WebSocket handlers. File I/O runs in executor jobs to avoid blocking the async event loop.
- `custom_components/pyscrypt_manager/pyscrypt-manager-panel.js` — the entire frontend: a single Web Component (`HTMLElement` + shadow DOM). Vanilla ES2022 modules, no bundler/transpiler, no JS package manager. CodeMirror 6 is imported at runtime from the esm.sh CDN. UI is manual HTML-string templating + CSS Grid/Flex with CSS-variable theming.

WebSocket message contract (backend ↔ panel):
- `pyscrypt_manager/list_files` → array of `{path, name, size, mtime}`
- `pyscrypt_manager/get_file` `{path}` → `{content}`
- `pyscrypt_manager/save_file` `{path, content}` → `{success: true}`

Scripts live in `{HA_CONFIG}/pyscript/`. Requires the `frontend` and `http` HA components (see `manifest.json`).

## Gotchas — do not regress these

- **Path-traversal guard** (`__init__.py`): file paths are validated with `startswith(pyscript_dir_prefix)` where the prefix includes a trailing `os.path.sep`. Keep the trailing separator — it closes the directory-escape window.
- **CodeMirror race guard** (panel JS): a `_cmGeneration` counter is incremented on rebuild; the async CDN-fetch path bails if the generation changed mid-fetch, preventing double-init. Preserve this when touching editor setup.
- **Load-error save protection**: when a file fails to load, the editor mounts read-only with an error placeholder and save is disabled — so the error text never overwrites the real script on disk. Don't re-enable save in that state.
- **Service-cache optimization**: the component caches serialized `hass.services.pyscript` and only re-renders when it actually changes. The `hass` setter fires constantly on HA state updates — avoid doing work there unconditionally.
- **System service filtering**: `reload`, `generate_stubs`, `jupyter_kernel_start` are filtered out client-side. Only `.py` scripts are shown.
- **CDN dependency**: the editor depends on esm.sh being reachable; failures are surfaced with a visible retry rather than silently swallowed.

## Verifying changes

No test suite or CI. To verify: copy `custom_components/pyscrypt_manager/` into a running Home Assistant config's `custom_components/`, restart HA Core, then open the panel in the browser and exercise the changed behavior.

## Git workflow

Commit and push after each individual change (`git add` the changed files, commit, push) — do not batch unrelated changes.
