# Pyscrypt Manager

A dedicated Home Assistant custom panel integration that provides a full-page sidebar application to list, configure, and execute Python scripts installed via the [pyscript](https://github.com/custom-components/pyscript) integration.

Unlike Lovelace dashboards, this runs as a **dedicated application** directly registered on your Home Assistant sidebar, offering a clean, distraction-free workspace.

![Aesthetic Preview](https://img.shields.io/badge/Design-Glassmorphic-blueviolet?style=for-the-badge)
![Home Assistant](https://img.shields.io/badge/Home_Assistant-2026.6.3+-blue?style=for-the-badge&logo=home-assistant)

## Features

- 🐍 **Dedicated Sidebar App**: Registers as a native sidebar panel app (`/pyscrypt-manager`), bypassing the need for dashboard cards.
- ⚙️ **Dynamic Argument Forms**: Translates script parameters (text inputs, selects, toggles, number sliders) into responsive UI form controls.
- ⚡ **Interactive Terminal Console**: Shows real-time loader indicators, success/failure execution states, and formats returned JSON payload outputs.
- 🔄 **Core Integration Controls**: Features a "Reload Pyscripts" trigger to refresh scripts instantly without leaving the app.
- 🔍 **Fuzzy Searching & Filtering**: Search bar and quick-filters for custom user scripts vs. system helpers.
- 💎 **Premium Glassmorphic Workspace**: Full-screen dark-themed dashboard tailored to high-density desktop displays.

## Installation & Setup

We have automatically set up and copied the files to your local Home Assistant instance. If you need to replicate this manually, follow the steps below:

### 1. Copy the Custom Component
Copy the `pyscrypt_manager` directory into your Home Assistant's `custom_components` directory:
```bash
cp -r custom_components/pyscrypt_manager /path/to/home-assistant/config/custom_components/
```
In your setup, the path is:
`[home-assistant-config/custom_components/pyscrypt_manager](file:///Users/allistera/Development/Projects/home-assistant-config/custom_components/pyscrypt_manager)`

### 2. Enable in Configuration
Add the `pyscrypt_manager` domain configuration to your `configuration.yaml` file:
```yaml
pyscrypt_manager:
```

### 3. Restart Home Assistant
Restart Home Assistant to load the integration. Once restarted, **Pyscrypt Manager** will automatically appear in your Home Assistant sidebar menu.

## Repository Layout
- `custom_components/pyscrypt_manager/`
  - [__init__.py](file:///Users/allistera/Development/Projects/pyscrypt-manager/custom_components/pyscrypt_manager/__init__.py) — Bootstraps integration and registers sidebar panel.
  - [manifest.json](file:///Users/allistera/Development/Projects/pyscrypt-manager/custom_components/pyscrypt_manager/manifest.json) — Home Assistant integration parameters.
  - [pyscrypt-manager-panel.js](file:///Users/allistera/Development/Projects/pyscrypt-manager/custom_components/pyscrypt_manager/pyscrypt-manager-panel.js) — The HTML/CSS/JS frontend panel application.
