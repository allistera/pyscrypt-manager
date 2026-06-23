"""Pyscrypt Manager integration for Home Assistant."""
from __future__ import annotations

import ast
import logging
import os

from homeassistant.components import websocket_api
from homeassistant.components.frontend import async_register_built_in_panel
from homeassistant.components.http import StaticPathConfig
from homeassistant.core import HomeAssistant
from homeassistant.helpers import config_validation as cv
import voluptuous as vol

_LOGGER = logging.getLogger(__name__)
DOMAIN = "pyscrypt_manager"

CONFIG_SCHEMA = cv.empty_config_schema(DOMAIN)


def _extract_service_names(source: str) -> list[str]:
    """Return the pyscript service names a source file registers.

    Pyscript names a service after the function decorated with ``@service``
    (not the filename), so we statically parse the decorators rather than
    guessing from the path. ``@service("domain.name")`` overrides the name;
    the ``supports_response`` keyword is ignored.
    """
    try:
        tree = ast.parse(source)
    except (SyntaxError, ValueError):
        return []

    names: set[str] = set()
    for node in ast.walk(tree):
        if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue
        for dec in node.decorator_list:
            # @service
            if isinstance(dec, ast.Name) and dec.id == "service":
                names.add(node.name)
            # @service(...) — explicit positional name wins, else function name
            elif isinstance(dec, ast.Call) and (
                isinstance(dec.func, ast.Name) and dec.func.id == "service"
            ):
                explicit = next(
                    (
                        a.value
                        for a in dec.args
                        if isinstance(a, ast.Constant) and isinstance(a.value, str)
                    ),
                    None,
                )
                names.add(explicit.split(".", 1)[-1] if explicit else node.name)
    return sorted(names)


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    """Set up the Pyscrypt Manager component."""
    _LOGGER.warning("Pyscrypt Manager async_setup started")
    await async_register_frontend_resources(hass)
    await async_register_frontend_panel(hass)
    _register_websocket_handlers(hass)
    _LOGGER.warning("Pyscrypt Manager integration initialized")
    return True


async def async_register_frontend_resources(hass: HomeAssistant) -> None:
    """Register frontend resources."""
    integration_dir = os.path.dirname(__file__)
    # Register static path for the panel JS file
    await hass.http.async_register_static_paths([
        StaticPathConfig(
            "/pyscrypt_manager_static", integration_dir, cache_headers=False
        ),
    ])
    _LOGGER.info("Registered static path for Pyscrypt Manager frontend resources")


async def async_register_frontend_panel(hass: HomeAssistant) -> None:
    """Register the Pyscrypt Manager sidebar panel."""
    async_register_built_in_panel(
        hass,
        component_name="custom",
        sidebar_title="Pyscrypt Manager",
        sidebar_icon="mdi:language-python",
        frontend_url_path="pyscrypt-manager",
        config={
            "_panel_custom": {
                "name": "pyscrypt-manager-panel",
                "module_url": "/pyscrypt_manager_static/pyscrypt-manager-panel.js?v=19",
            }
        },
        require_admin=False,
    )


def _register_websocket_handlers(hass: HomeAssistant) -> None:
    """Register WebSocket command handlers."""
    websocket_api.async_register_command(hass, ws_list_files)
    websocket_api.async_register_command(hass, ws_get_file)
    websocket_api.async_register_command(hass, ws_save_file)
    _LOGGER.info("Registered Pyscrypt Manager WebSocket commands")


@websocket_api.websocket_command({
    vol.Required("type"): "pyscrypt_manager/list_files",
})
@websocket_api.async_response
async def ws_list_files(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict,
) -> None:
    """List all pyscript files."""
    pyscript_dir = os.path.join(hass.config.config_dir, "pyscript")
    if not os.path.exists(pyscript_dir):
        connection.send_result(msg["id"], [])
        return

    def get_files():
        files = []
        for root, _, filenames in os.walk(pyscript_dir):
            for filename in filenames:
                if filename.endswith(".py"):
                    abs_path = os.path.join(root, filename)
                    rel_path = os.path.relpath(abs_path, pyscript_dir)

                    try:
                        size = os.path.getsize(abs_path)
                        mtime = os.path.getmtime(abs_path)
                    except OSError:
                        size = 0
                        mtime = 0

                    try:
                        with open(abs_path, encoding="utf-8") as f:
                            services = _extract_service_names(f.read())
                    except OSError:
                        services = []

                    files.append({
                        "path": rel_path,
                        "name": filename,
                        "size": size,
                        "mtime": mtime,
                        "services": services,
                    })
        return files

    files_list = await hass.async_add_executor_job(get_files)
    connection.send_result(msg["id"], files_list)


@websocket_api.websocket_command({
    vol.Required("type"): "pyscrypt_manager/get_file",
    vol.Required("path"): str,
})
@websocket_api.async_response
async def ws_get_file(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict,
) -> None:
    """Get content of a pyscript file."""
    pyscript_dir = os.path.join(hass.config.config_dir, "pyscript")
    file_path = os.path.abspath(os.path.join(pyscript_dir, msg["path"]))

    # Secure path traversal check with trailing separator
    pyscript_dir_prefix = (
        pyscript_dir
        if pyscript_dir.endswith(os.path.sep)
        else pyscript_dir + os.path.sep
    )
    if not file_path.startswith(pyscript_dir_prefix) and file_path != pyscript_dir:
        connection.send_error(msg["id"], "unauthorized", "Access denied")
        return

    if not os.path.exists(file_path):
        connection.send_error(msg["id"], "not_found", "File not found")
        return

    try:
        def read_file():
            with open(file_path, encoding="utf-8") as f:
                return f.read()
        content = await hass.async_add_executor_job(read_file)
        connection.send_result(msg["id"], {"content": content})
    except Exception as err:
        connection.send_error(msg["id"], "read_error", str(err))


@websocket_api.websocket_command({
    vol.Required("type"): "pyscrypt_manager/save_file",
    vol.Required("path"): str,
    vol.Required("content"): str,
})
@websocket_api.async_response
async def ws_save_file(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict,
) -> None:
    """Save content of a pyscript file."""
    pyscript_dir = os.path.join(hass.config.config_dir, "pyscript")
    file_path = os.path.abspath(os.path.join(pyscript_dir, msg["path"]))

    # Secure path traversal check with trailing separator
    pyscript_dir_prefix = (
        pyscript_dir
        if pyscript_dir.endswith(os.path.sep)
        else pyscript_dir + os.path.sep
    )
    if not file_path.startswith(pyscript_dir_prefix) and file_path != pyscript_dir:
        connection.send_error(msg["id"], "unauthorized", "Access denied")
        return

    try:
        def write_file():
            os.makedirs(os.path.dirname(file_path), exist_ok=True)
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(msg["content"])
        await hass.async_add_executor_job(write_file)
        connection.send_result(msg["id"], {"success": True})
    except Exception as err:
        connection.send_error(msg["id"], "write_error", str(err))
