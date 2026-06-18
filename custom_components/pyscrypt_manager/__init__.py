"""Pyscrypt Manager integration for Home Assistant."""
from __future__ import annotations

import logging
import os
import re

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.components.frontend import async_register_built_in_panel
from homeassistant.components.http import StaticPathConfig
from homeassistant.core import HomeAssistant
from homeassistant.helpers import config_validation as cv

_LOGGER = logging.getLogger(__name__)
DOMAIN = "pyscrypt_manager"

CONFIG_SCHEMA = cv.empty_config_schema(DOMAIN)


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
        StaticPathConfig("/pyscrypt_manager_static", integration_dir, cache_headers=False),
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
                "module_url": "/pyscrypt_manager_static/pyscrypt-manager-panel.js?v=7",
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


def extract_metadata(file_path: str) -> tuple[list[str], str]:
    """Extract tags and description from comment lines at start of script."""
    tags = []
    description = ""
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            for _ in range(15):  # read first 15 lines
                line = f.readline()
                if not line:
                    break
                line = line.strip()
                # Match tags (e.g. # tags: climate, active, helper)
                tag_match = re.match(r"^#\s*tags?:\s*(.*)$", line, re.IGNORECASE)
                if tag_match:
                    tags = [t.strip().lower() for t in tag_match.group(1).split(",") if t.strip()]
                # Match description (e.g. # description: My utility script)
                desc_match = re.match(r"^#\s*description:\s*(.*)$", line, re.IGNORECASE)
                if desc_match:
                    description = desc_match.group(1).strip()
    except Exception:
        pass
    return tags, description


@websocket_api.websocket_command({
    vol.Required("type"): "pyscrypt_manager/list_files",
})
@websocket_api.async_response
async def ws_list_files(
    hass: HomeAssistant,
    connection: websocket_api.ActiveConnection,
    msg: dict,
) -> None:
    """List all pyscript files with metadata."""
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
                    
                    # Extract tags and description from python file comments
                    tags, description = extract_metadata(abs_path)
                    
                    try:
                        size = os.path.getsize(abs_path)
                        mtime = os.path.getmtime(abs_path)
                    except OSError:
                        size = 0
                        mtime = 0
                        
                    files.append({
                        "path": rel_path,
                        "name": filename,
                        "size": size,
                        "mtime": mtime,
                        "tags": tags,
                        "custom_description": description,
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
    
    # Path traversal safety check
    if not file_path.startswith(pyscript_dir):
        connection.send_error(msg["id"], "unauthorized", "Access denied")
        return

    if not os.path.exists(file_path):
        connection.send_error(msg["id"], "not_found", "File not found")
        return

    try:
        def read_file():
            with open(file_path, "r", encoding="utf-8") as f:
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
    
    # Path traversal safety check
    if not file_path.startswith(pyscript_dir):
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
