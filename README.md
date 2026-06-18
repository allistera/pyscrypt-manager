# Pyscrypt Manager

A sleek, modern Home Assistant user interface and custom Lovelace card to list, configure, and execute Python scripts installed via the [pyscript](https://github.com/custom-components/pyscript) integration.

Designed to be accessible directly from your Home Assistant sidebar as a dedicated panel/application.

![Aesthetic Preview](https://img.shields.io/badge/Design-Glassmorphic-blueviolet?style=for-the-badge)
![Home Assistant](https://img.shields.io/badge/Home_Assistant-2026.6.3+-blue?style=for-the-badge&logo=home-assistant)

## Features

- 🐍 **Dynamic Script Listing**: Automatically reads all services from the `pyscript` domain and lists them.
- ⚙️ **Automatic Argument Parsing**: Dynamically generates form controls based on the script's arguments/fields (e.g. text inputs, select dropdowns, toggle checkboxes, number sliders).
- ⚡ **Interactive Run & Terminal Console**: Displays a beautiful glowing dark terminal-style console for each script, updating with success/failure feedback and returning JSON payload responses.
- 🔄 **Quick Actions**: Features a direct "Reload All" action to trigger `pyscript.reload` and refresh your scripts instantly.
- 🔍 **Filtering & Search**: Includes a real-time fuzzy search bar and filters to quickly distinguish between custom user scripts and system helper scripts (like `generate_stubs`).
- 💎 **Premium Dark Glassmorphic Design**: Clean gradients, pulsing states, and smooth slide transitions.

## Installation & Setup

We have automatically deployed the custom card and configured the sidebar panel in your Home Assistant instance. If you need to reinstall or replicate this manually, follow the steps below:

### 1. Copy the Card File
Copy the `pyscript-manager-card.js` file into your Home Assistant's `www` configuration folder:
```bash
cp pyscript-manager-card.js /path/to/home-assistant/config/www/
```
In your setup, the path is:
`[home-assistant-config/www/pyscript-manager-card.js](file:///Users/allistera/Development/Projects/home-assistant-config/www/pyscript-manager-card.js)`

### 2. Register Dashboard Resource
Add `/local/pyscript-manager-card.js` as a dashboard resource of type `module` in Home Assistant:
- Go to **Settings** > **Dashboards** > **Resources (three dots menu)**.
- Click **Add Resource**.
- Enter URL: `/local/pyscript-manager-card.js`
- Select Resource Type: `JavaScript Module`.

### 3. Create Sidebar Panel / Dashboard
Add a new dashboard in your `configuration.yaml` or through the Lovelace UI:
- **URL Path**: `pyscript-manager`
- **Title**: `Pyscrypt Manager`
- **Icon**: `mdi:language-python`
- **Show in Sidebar**: Checked

In the dashboard, edit the raw configuration and define it as a panel view with the custom card:
```yaml
title: Pyscrypt Manager
views:
  - title: Pyscrypt Manager
    type: panel
    cards:
      - type: custom:pyscript-manager-card
```

## Developer Notes

This project was built using:
- **Vanilla CSS & JS**: For robust rendering, zero dependency bloating, and compatibility.
- **Custom SVG Assets**: CRISP vector graphics for icons, ensuring high-res compatibility.
- **Shadow DOM**: Complete style isolation so that Home Assistant themes don't accidentally override the card's bespoke glassmorphic styles.
