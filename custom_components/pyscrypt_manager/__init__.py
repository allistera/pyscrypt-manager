"""Pyscrypt Manager integration for Home Assistant."""
from __future__ import annotations

import logging
import os

from homeassistant.components.frontend import async_register_built_in_panel
from homeassistant.components.http import StaticPathConfig
from homeassistant.core import HomeAssistant
from homeassistant.helpers import config_validation as cv

_LOGGER = logging.getLogger(__name__)
DOMAIN = "pyscrypt_manager"

CONFIG_SCHEMA = cv.empty_config_schema(DOMAIN)


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    """Set up the Pyscrypt Manager component."""
    await async_register_frontend_resources(hass)
    await async_register_frontend_panel(hass)
    _LOGGER.info("Pyscrypt Manager integration initialized")
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
                "module_url": "/pyscrypt_manager_static/pyscrypt-manager-panel.js?v=1",
            }
        },
        require_admin=False,
    )
