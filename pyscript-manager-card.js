/**
 * Pyscript Manager Card for Home Assistant
 * A custom Lovelace card to manage, list, configure, and execute Home Assistant pyscripts.
 */

class PyscriptManagerCard extends HTMLElement {
  // Home Assistant will call this to set the card's configuration
  setConfig(config) {
    this.config = config || {};
  }

  // Home Assistant calls this when the state changes (or when initialized)
  set hass(hass) {
    this._hass = hass;
    if (!this.shadowRoot) {
      this.initCard();
    }
    this.updateCard();
  }

  // Initialize the shadow DOM and base elements
  initCard() {
    this.attachShadow({ mode: 'open' });
    
    // Create base container
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          --primary-color: #03a9f4;
          --accent-color: #ff9800;
          --success-color: #4caf50;
          --error-color: #f44336;
          --card-background: rgba(25ings, 255, 255, 0.03);
          --card-border-radius: 16px;
          --font-family: 'Outfit', 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          
          display: block;
          margin-bottom: 16px;
        }

        .manager-card {
          font-family: var(--font-family);
          background: var(--ha-card-background, #1c1c1e);
          border-radius: var(--card-border-radius);
          border: 1px solid var(--ha-card-border-color, rgba(255, 255, 255, 0.1));
          box-shadow: var(--ha-card-box-shadow, 0 8px 32px 0 rgba(0, 0, 0, 0.37));
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          padding: 24px;
          color: var(--primary-text-color, #e1e1e6);
          overflow: hidden;
          transition: all 0.3s ease;
        }

        /* Header Styles */
        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 24px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          padding-bottom: 16px;
        }

        .header-title {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .logo-container {
          background: linear-gradient(135deg, #306998 0%, #ffd43b 100%);
          width: 42px;
          height: 42px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 15px rgba(48, 105, 152, 0.4);
        }

        .logo-svg {
          width: 26px;
          height: 26px;
        }

        .title-text h2 {
          margin: 0;
          font-size: 1.4rem;
          font-weight: 700;
          letter-spacing: -0.5px;
          background: linear-gradient(90deg, #e1e1e6 0%, #a1a1aa 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .title-text p {
          margin: 2px 0 0 0;
          font-size: 0.8rem;
          color: var(--secondary-text-color, #a1a1aa);
        }

        .header-actions {
          display: flex;
          gap: 8px;
        }

        /* Action Buttons */
        .btn-reload {
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 8px;
          color: var(--primary-text-color, #e1e1e6);
          padding: 8px 12px;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 0.2s ease;
        }

        .btn-reload:hover {
          background: rgba(255, 255, 255, 0.15);
          border-color: rgba(255, 255, 255, 0.2);
          transform: translateY(-1px);
        }

        .btn-reload:active {
          transform: translateY(0);
        }

        .spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          100% { transform: rotate(-360deg); }
        }

        /* Search & Filter bar */
        .filter-bar {
          display: flex;
          gap: 12px;
          margin-bottom: 20px;
        }

        .search-container {
          position: relative;
          flex-grow: 1;
        }

        .search-input {
          width: 100%;
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 10px 12px 10px 36px;
          color: #fff;
          font-size: 0.9rem;
          font-family: inherit;
          box-sizing: border-box;
          transition: all 0.2s ease;
        }

        .search-input:focus {
          outline: none;
          border-color: var(--primary-color);
          box-shadow: 0 0 0 3px rgba(3, 169, 244, 0.15);
        }

        .search-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          width: 16px;
          height: 16px;
          fill: var(--secondary-text-color, #a1a1aa);
          pointer-events: none;
        }

        .filter-select {
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 0 12px;
          color: var(--primary-text-color, #e1e1e6);
          font-size: 0.85rem;
          font-family: inherit;
          cursor: pointer;
        }

        .filter-select:focus {
          outline: none;
          border-color: var(--primary-color);
        }

        /* Script Items */
        .scripts-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
          max-height: 480px;
          overflow-y: auto;
          padding-right: 4px;
        }

        /* Custom Scrollbar */
        .scripts-list::-webkit-scrollbar {
          width: 6px;
        }
        .scripts-list::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.05);
          border-radius: 3px;
        }
        .scripts-list::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 3px;
        }
        .scripts-list::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }

        .script-card {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 10px;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          overflow: hidden;
        }

        .script-card:hover {
          background: rgba(255, 255, 255, 0.04);
          border-color: rgba(255, 255, 255, 0.1);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }

        .script-card.expanded {
          background: rgba(255, 255, 255, 0.04);
          border-color: rgba(255, 255, 255, 0.15);
        }

        .script-summary {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 16px;
          cursor: pointer;
          user-select: none;
        }

        .script-info {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-grow: 1;
          min-width: 0;
        }

        .script-icon-wrapper {
          background: rgba(255, 255, 255, 0.06);
          width: 36px;
          height: 36px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--primary-color);
          flex-shrink: 0;
        }

        .script-icon-wrapper.system {
          color: var(--accent-color);
        }

        .script-icon {
          width: 20px;
          height: 20px;
          fill: currentColor;
        }

        .script-details-meta {
          min-width: 0;
        }

        .script-name {
          font-weight: 600;
          font-size: 0.95rem;
          margin: 0;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .badge-system {
          font-size: 0.7rem;
          background: rgba(255, 152, 0, 0.15);
          color: var(--accent-color);
          padding: 2px 6px;
          border-radius: 4px;
          border: 1px solid rgba(255, 152, 0, 0.2);
          font-weight: 500;
        }

        .script-description {
          margin: 3px 0 0 0;
          font-size: 0.8rem;
          color: var(--secondary-text-color, #a1a1aa);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .script-actions {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .arrow-icon {
          width: 18px;
          height: 18px;
          fill: var(--secondary-text-color, #a1a1aa);
          transition: transform 0.25s ease;
        }

        .script-card.expanded .arrow-icon {
          transform: rotate(180deg);
        }

        /* Detail Form inside Expanded Script */
        .script-detail-body {
          border-top: 1px solid rgba(255, 255, 255, 0.06);
          padding: 16px 20px 20px 20px;
          background: rgba(0, 0, 0, 0.15);
          display: none;
        }

        .script-card.expanded .script-detail-body {
          display: block;
        }

        .fields-title {
          font-size: 0.85rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin: 0 0 14px 0;
          color: var(--secondary-text-color, #a1a1aa);
        }

        .form-group {
          margin-bottom: 14px;
        }

        .form-label {
          display: block;
          font-size: 0.85rem;
          font-weight: 500;
          margin-bottom: 6px;
        }

        .form-label span.required {
          color: var(--error-color);
          margin-left: 2px;
        }

        .form-desc {
          font-size: 0.75rem;
          color: var(--secondary-text-color, #a1a1aa);
          margin: 0 0 6px 0;
        }

        .field-input {
          width: 100%;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          padding: 8px 10px;
          color: #fff;
          font-size: 0.85rem;
          font-family: inherit;
          box-sizing: border-box;
          transition: border-color 0.2s;
        }

        .field-input:focus {
          outline: none;
          border-color: var(--primary-color);
        }

        .field-select {
          width: 100%;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          padding: 8px 10px;
          color: #fff;
          font-size: 0.85rem;
          font-family: inherit;
          box-sizing: border-box;
          cursor: pointer;
        }

        .checkbox-container {
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
          user-select: none;
          font-size: 0.85rem;
        }

        .checkbox-input {
          width: 16px;
          height: 16px;
          accent-color: var(--primary-color);
          cursor: pointer;
        }

        .range-container {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .range-slider {
          flex-grow: 1;
          accent-color: var(--primary-color);
        }

        .range-value {
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--primary-color);
          min-width: 36px;
          text-align: right;
        }

        /* Action Buttons and Run Console */
        .action-row {
          display: flex;
          gap: 12px;
          align-items: center;
          margin-top: 18px;
        }

        .btn-run {
          background: linear-gradient(135deg, #0288d1 0%, #26c6da 100%);
          border: none;
          color: white;
          padding: 10px 18px;
          font-size: 0.9rem;
          font-weight: 700;
          border-radius: 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.2s ease;
          box-shadow: 0 4px 15px rgba(3, 169, 244, 0.3);
        }

        .btn-run:hover {
          filter: brightness(1.1);
          transform: translateY(-1px);
          box-shadow: 0 6px 18px rgba(3, 169, 244, 0.45);
        }

        .btn-run:active {
          transform: translateY(0);
        }

        .btn-run:disabled {
          background: rgba(255, 255, 255, 0.08);
          color: var(--secondary-text-color, #a1a1aa);
          cursor: not-allowed;
          box-shadow: none;
          transform: none;
        }

        .spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }

        /* Console Output Styles */
        .console-output {
          margin-top: 16px;
          border-radius: 8px;
          background: #0d0e15;
          border: 1px solid rgba(255, 255, 255, 0.08);
          font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
          font-size: 0.8rem;
          overflow: hidden;
        }

        .console-header {
          background: #141622;
          padding: 8px 12px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          user-select: none;
        }

        .console-title {
          color: var(--secondary-text-color, #a1a1aa);
          font-weight: 600;
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .console-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #ff5f56;
          display: inline-block;
        }

        .console-dot.success {
          background: var(--success-color);
        }

        .console-time {
          font-size: 0.7rem;
          color: rgba(255, 255, 255, 0.4);
        }

        .console-body {
          padding: 12px;
          max-height: 150px;
          overflow-y: auto;
          white-space: pre-wrap;
          color: #a8ff60; /* Soft green terminal text */
        }

        .console-body.error {
          color: #ff5f56; /* Soft red terminal text */
        }

        .console-body.empty {
          color: rgba(255, 255, 255, 0.3);
          font-style: italic;
        }

        /* Error Banner */
        .error-banner {
          background: rgba(244, 67, 54, 0.1);
          border: 1px solid rgba(244, 67, 54, 0.2);
          border-radius: 8px;
          padding: 12px 16px;
          margin-bottom: 16px;
          color: #ff8a80;
          font-size: 0.85rem;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .error-banner-icon {
          width: 20px;
          height: 20px;
          fill: currentColor;
          flex-shrink: 0;
        }
      </style>
      <div class="manager-card">
        <div class="header">
          <div class="header-title">
            <div class="logo-container">
              <svg class="logo-svg" viewBox="0 0 110 110">
                <path fill="#306998" d="M54.2 10.4c-17.6 0-16.5 7.6-16.5 7.6l.1 7.9h16.7v2.3H17.8s-7.6-1.1-7.6 16.5c0 17.6 6.8 16.9 6.8 16.9h4.1v-5.7c0-9.6 8.3-9 8.3-9h16.9c9.3 0 8.6-8.3 8.6-8.3v-17s1.3-11.2-10.7-11.2z"/>
                <path fill="#ffd43b" d="M54.8 98.6c17.6 0 16.5-7.6 16.5-7.6l-.1-7.9H54.5v-2.3h36.7s7.6 1.1 7.6-16.5c0-17.6-6.8-16.9-6.8-16.9h-4.1v5.7c0 9.6-8.3 9-8.3 9H62.7c-9.3 0-8.6 8.3-8.6 8.3v17s-1.3 11.2 10.7 11.2z"/>
                <circle cx="28.4" cy="22.2" r="3.2" fill="#fff"/>
                <circle cx="80.6" cy="86.8" r="3.2" fill="#111"/>
              </svg>
            </div>
            <div class="title-text">
              <h2>Pyscrypt Manager</h2>
              <p>Execute and manage python automation scripts</p>
            </div>
          </div>
          <div class="header-actions">
            <button class="btn-reload" id="btn-reload-all">
              <svg class="script-icon" viewBox="0 0 24 24" style="width:16px;height:16px;">
                <path d="M17.65,6.35C16.2,4.9 14.21,4 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20C15.73,20 18.84,17.45 19.73,14H17.65C16.83,16.33 14.61,18 12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6C13.66,6 15.14,6.69 16.22,7.78L13,11H20V4L17.65,6.35Z" />
              </svg>
              Reload All
            </button>
          </div>
        </div>

        <div id="error-container"></div>

        <div class="filter-bar">
          <div class="search-container">
            <svg class="search-icon" viewBox="0 0 24 24">
              <path d="M9.5,3A6.5,6.5 0 0,1 16,9.5C16,11.11 15.41,12.59 14.44,13.73L14.71,14H15.5L20.5,19L19,20.5L14,15.5V14.71L13.73,14.44C12.59,15.41 11.11,16 9.5,16A6.5,6.5 0 0,1 3,9.5A6.5,6.5 0 0,1 9.5,3M9.5,5C7,5 5,7 5,9.5C5,12 7,14 9.5,14C12,14 14,12 14,9.5C14,7 12,5 9.5,5Z" />
            </svg>
            <input type="text" class="search-input" id="search-box" placeholder="Search pyscripts...">
          </div>
          <select class="filter-select" id="filter-type">
            <option value="all">All Scripts</option>
            <option value="custom">Custom Scripts</option>
            <option value="system">System Scripts</option>
          </select>
        </div>

        <div class="scripts-list" id="scripts-list-container">
          <!-- Scripts will be populated dynamically -->
        </div>
      </div>
    `;

    // Attach event listeners
    this.shadowRoot.getElementById('btn-reload-all').addEventListener('click', () => this.reloadAllPyscripts());
    this.shadowRoot.getElementById('search-box').addEventListener('input', () => this.updateCard());
    this.shadowRoot.getElementById('filter-type').addEventListener('change', () => this.updateCard());
    
    this.searchBox = this.shadowRoot.getElementById('search-box');
    this.filterType = this.shadowRoot.getElementById('filter-type');
    this.scriptsContainer = this.shadowRoot.getElementById('scripts-list-container');
    this.errorContainer = this.shadowRoot.getElementById('error-container');
  }

  // Reload all pyscripts
  async reloadAllPyscripts() {
    const btn = this.shadowRoot.getElementById('btn-reload-all');
    const svg = btn.querySelector('svg');
    
    try {
      svg.classList.add('spin');
      btn.disabled = true;
      
      await this._hass.callService('pyscript', 'reload', {});
      
      // Flash success styling
      btn.style.borderColor = 'var(--success-color)';
      btn.style.color = 'var(--success-color)';
      setTimeout(() => {
        btn.style.borderColor = '';
        btn.style.color = '';
      }, 1500);
      
    } catch (err) {
      console.error("Error reloading pyscripts:", err);
      // Flash error styling
      btn.style.borderColor = 'var(--error-color)';
      btn.style.color = 'var(--error-color)';
      setTimeout(() => {
        btn.style.borderColor = '';
        btn.style.color = '';
      }, 1500);
    } finally {
      svg.classList.remove('spin');
      btn.disabled = false;
    }
  }

  // Update card content based on state and inputs
  updateCard() {
    if (!this._hass) return;

    // Check if pyscript service is available
    const pyscriptServices = this._hass.services.pyscript;
    if (!pyscriptServices) {
      this.errorContainer.innerHTML = `
        <div class="error-banner">
          <svg class="error-banner-icon" viewBox="0 0 24 24">
            <path d="M13 14H11V9H13M13 18H11V16H13M1 21H23L12 2L1 21Z" />
          </svg>
          <div>
            <strong>Pyscript integration not found.</strong>
            Please ensure you have the <a href="https://github.com/custom-components/pyscript" target="_blank" style="color: inherit; text-decoration: underline;">Pyscript Custom Component</a> installed and configured.
          </div>
        </div>
      `;
      this.scriptsContainer.innerHTML = '';
      return;
    } else {
      this.errorContainer.innerHTML = '';
    }

    const searchQuery = this.searchBox ? this.searchBox.value.toLowerCase().trim() : '';
    const filterVal = this.filterType ? this.filterType.value : 'all';

    // Get list of scripts
    const scriptKeys = Object.keys(pyscriptServices).sort();
    
    // Clear and rebuild scripts container if needed
    let html = '';
    
    let count = 0;
    scriptKeys.forEach(key => {
      const serviceData = pyscriptServices[key];
      const displayName = serviceData.name || key;
      const isSystem = ['reload', 'generate_stubs', 'jupyter_kernel_start'].includes(key);
      
      // Filter logic
      if (filterVal === 'custom' && isSystem) return;
      if (filterVal === 'system' && !isSystem) return;
      
      if (searchQuery) {
        const matchName = displayName.toLowerCase().includes(searchQuery);
        const matchKey = key.toLowerCase().includes(searchQuery);
        const matchDesc = (serviceData.description || '').toLowerCase().includes(searchQuery);
        if (!matchName && !matchKey && !matchDesc) return;
      }
      
      count++;
      const isExpanded = this.selectedService === key;
      
      // SVG path definition based on whether it is system or custom script
      const scriptIconSvg = isSystem 
        ? `<svg class="script-icon" viewBox="0 0 24 24"><path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4M12,6A6,6 0 0,0 6,12A6,6 0 0,0 12,18A6,6 0 0,0 18,12A6,6 0 0,0 12,6M12,8A4,4 0 0,1 16,12A4,4 0 0,1 12,16A4,4 0 0,1 8,12A4,4 0 0,1 12,8Z"/></svg>`
        : `<svg class="script-icon" viewBox="0 0 24 24"><path d="M12.89,3L14.85,3.4L11.11,21L9.15,20.6L12.89,3M19.59,12L16,8.41V5.58L22.42,12L16,18.41V15.58L19.59,12M1.58,12L8,5.58V8.41L4.41,12L8,15.58V18.41L1.58,12Z"/></svg>`;

      html += `
        <div class="script-card ${isExpanded ? 'expanded' : ''}" data-key="${key}">
          <div class="script-summary">
            <div class="script-info">
              <div class="script-icon-wrapper ${isSystem ? 'system' : ''}">
                ${scriptIconSvg}
              </div>
              <div class="script-details-meta">
                <div class="script-name">
                  ${displayName}
                  ${isSystem ? `<span class="badge-system">System</span>` : ''}
                </div>
                <div class="script-description">${serviceData.description || 'No description available.'}</div>
              </div>
            </div>
            <div class="script-actions">
              <svg class="arrow-icon" viewBox="0 0 24 24">
                <path d="M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z" />
              </svg>
            </div>
          </div>
          
          <div class="script-detail-body">
            <p style="margin: 0 0 16px 0; font-size: 0.85rem; color: rgba(255, 255, 255, 0.7);">
              <strong>Service name:</strong> <code style="background:rgba(0,0,0,0.3); padding: 2px 6px; border-radius: 4px;">pyscript.${key}</code>
            </p>
            
            ${this.renderFieldsForm(key, serviceData.fields)}
            
            <div class="action-row">
              <button class="btn-run" id="run-${key}" ${this.loading[key] ? 'disabled' : ''}>
                ${this.loading[key] ? '<div class="spinner"></div>' : `
                  <svg viewBox="0 0 24 24" style="width:18px;height:18px;fill:currentColor;">
                    <path d="M8,5.14V19.14L19,12.14L8,5.14Z" />
                  </svg>
                `}
                ${this.loading[key] ? 'Running...' : 'Execute Script'}
              </button>
            </div>
            
            ${this.renderConsoleOutput(key)}
          </div>
        </div>
      `;
    });

    if (count === 0) {
      html = `<div style="text-align: center; padding: 32px; color: var(--secondary-text-color, #a1a1aa); font-size: 0.9rem;">No scripts found matching the filters.</div>`;
    }

    this.scriptsContainer.innerHTML = html;

    // Attach listeners to script headers
    this.shadowRoot.querySelectorAll('.script-summary').forEach(el => {
      el.addEventListener('click', (e) => {
        const card = e.currentTarget.parentElement;
        const key = card.getAttribute('data-key');
        
        if (this.selectedService === key) {
          this.selectedService = null;
        } else {
          this.selectedService = key;
        }
        this.updateCard();
      });
    });

    // Attach listeners to execute buttons
    this.shadowRoot.querySelectorAll('.btn-run').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const key = e.currentTarget.id.replace('run-', '');
        this.runScript(key, pyscriptServices[key]);
      });
    });

    // Attach listeners to input changes for dynamic controls like ranges
    this.shadowRoot.querySelectorAll('.range-slider').forEach(el => {
      el.addEventListener('input', (e) => {
        const key = e.target.getAttribute('data-script');
        const fieldName = e.target.getAttribute('data-field');
        const valSpan = this.shadowRoot.getElementById(`val-${key}-${fieldName}`);
        if (valSpan) {
          valSpan.textContent = e.target.value;
        }
      });
    });

    // Prevent summary click triggering when clicking inputs/labels inside detail body
    this.shadowRoot.querySelectorAll('.script-detail-body').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    });
  }

  // Render service fields as an HTML form dynamically
  renderFieldsForm(scriptKey, fields) {
    if (!fields || Object.keys(fields).length === 0) {
      return `<p style="font-size: 0.85rem; color: rgba(255,255,255,0.4); margin: 0 0 12px 0; font-style: italic;">No arguments needed for this script.</p>`;
    }

    let fieldsHtml = `<h4 class="fields-title">Arguments</h4>`;
    
    Object.keys(fields).forEach(fieldName => {
      const field = fields[fieldName];
      const isRequired = field.required === true;
      const desc = field.description || '';
      const example = field.example ? `Example: ${field.example}` : '';
      
      // Determine selector type
      let selectorType = 'text';
      let selectOptions = [];
      let numMin = null;
      let numMax = null;
      let numStep = 1;

      if (field.selector) {
        if (field.selector.text) {
          selectorType = 'text';
        } else if (field.selector.boolean) {
          selectorType = 'boolean';
        } else if (field.selector.select) {
          selectorType = 'select';
          selectOptions = field.selector.select.options || [];
        } else if (field.selector.number) {
          selectorType = 'number';
          numMin = field.selector.number.min;
          numMax = field.selector.number.max;
          numStep = field.selector.number.step || 1;
        }
      } else if (field.type) {
        if (field.type.includes('select')) {
          selectorType = 'select';
          // Parse options like "select (tcp, udp)" or options array
          const match = field.type.match(/\(([^)]+)\)/);
          if (match) {
            selectOptions = match[1].split(',').map(o => o.trim());
          }
        } else if (field.type.includes('number')) {
          selectorType = 'number';
          const match = field.type.match(/\(([^)]+)\)/);
          if (match) {
            const range = match[1].split('-');
            if (range.length === 2) {
              numMin = parseFloat(range[0]);
              numMax = parseFloat(range[1]);
            }
          }
        } else if (field.type.includes('boolean')) {
          selectorType = 'boolean';
        }
      }

      fieldsHtml += `<div class="form-group">
        <label class="form-label">
          ${field.name || fieldName}
          ${isRequired ? `<span class="required">*</span>` : ''}
        </label>
        ${desc ? `<p class="form-desc">${desc}</p>` : ''}
      `;

      // Render actual input based on type
      const elementId = `input-${scriptKey}-${fieldName}`;
      const defaultVal = field.default !== undefined ? field.default : '';

      if (selectorType === 'boolean') {
        fieldsHtml += `
          <label class="checkbox-container">
            <input type="checkbox" class="checkbox-input" id="${elementId}" ${defaultVal ? 'checked' : ''}>
            <span>Enabled</span>
          </label>
        `;
      } else if (selectorType === 'select') {
        fieldsHtml += `
          <select class="field-select" id="${elementId}">
            ${selectOptions.map(opt => `<option value="${opt}" ${opt === defaultVal ? 'selected' : ''}>${opt}</option>`).join('')}
          </select>
        `;
      } else if (selectorType === 'number') {
        const hasMinMax = numMin !== null && numMax !== null;
        if (hasMinMax) {
          fieldsHtml += `
            <div class="range-container">
              <input type="range" class="range-slider" id="${elementId}" 
                min="${numMin}" max="${numMax}" step="${numStep}" 
                value="${defaultVal !== '' ? defaultVal : numMin}" 
                data-script="${scriptKey}" data-field="${fieldName}">
              <span class="range-value" id="val-${scriptKey}-${fieldName}">${defaultVal !== '' ? defaultVal : numMin}</span>
            </div>
          `;
        } else {
          fieldsHtml += `
            <input type="number" class="field-input" id="${elementId}" value="${defaultVal}">
          `;
        }
      } else {
        // Fallback to text input
        fieldsHtml += `
          <input type="text" class="field-input" id="${elementId}" value="${defaultVal}" placeholder="${example}">
        `;
      }

      fieldsHtml += `</div>`;
    });

    return fieldsHtml;
  }

  // Render the terminal console component for showing execution outputs
  renderConsoleOutput(scriptKey) {
    const result = this.results[scriptKey];
    
    let timeHtml = '';
    let titleHtml = 'Console Idle';
    let bodyHtml = 'Waiting for execution...';
    let isSuccess = false;
    let isEmpty = true;

    if (this.loading[scriptKey]) {
      titleHtml = 'Running Script...';
      bodyHtml = 'Calling service on Home Assistant event bus...\n';
      isEmpty = false;
    } else if (result) {
      isEmpty = false;
      isSuccess = result.success;
      timeHtml = `<span class="console-time">${result.timestamp}</span>`;
      
      if (result.success) {
        titleHtml = 'Success';
        if (result.data) {
          bodyHtml = `Service returned successfully.\n\nResponse:\n${JSON.stringify(result.data, null, 2)}`;
        } else {
          bodyHtml = 'Service executed successfully. Return response was empty.';
        }
      } else {
        titleHtml = 'Execution Failed';
        bodyHtml = `Error calling service:\n${result.error}`;
      }
    }

    return `
      <div class="console-output">
        <div class="console-header">
          <div class="console-title">
            <span class="console-dot ${isSuccess ? 'success' : ''}"></span>
            ${titleHtml}
          </div>
          ${timeHtml}
        </div>
        <div class="console-body ${isEmpty ? 'empty' : ''} ${!isSuccess && result ? 'error' : ''}">
          ${bodyHtml}
        </div>
      </div>
    `;
  }

  // Execute the script by parsing fields and calling the service on Home Assistant
  async runScript(scriptKey, serviceData) {
    const fields = serviceData.fields || {};
    const serviceParams = {};

    // Retrieve input values from DOM
    Object.keys(fields).forEach(fieldName => {
      const field = fields[fieldName];
      const elementId = `input-${scriptKey}-${fieldName}`;
      const inputEl = this.shadowRoot.getElementById(elementId);
      
      if (!inputEl) return;

      let value;
      // Determine input type
      if (inputEl.type === 'checkbox') {
        value = inputEl.checked;
      } else if (inputEl.type === 'range' || inputEl.type === 'number') {
        value = parseFloat(inputEl.value);
        if (isNaN(value)) value = undefined;
      } else {
        value = inputEl.value;
        // Strip out empty optional strings
        if (value === '' && !field.required) {
          value = undefined;
        }
      }

      if (value !== undefined) {
        serviceParams[fieldName] = value;
      }
    });

    try {
      this.loading[scriptKey] = true;
      this.updateCard();
      
      // Execute the service, supporting return_response (Home Assistant 2023.7+)
      const response = await this._hass.callService('pyscript', scriptKey, serviceParams, undefined, true);
      
      this.results[scriptKey] = {
        success: true,
        data: response,
        timestamp: new Date().toLocaleTimeString()
      };
      
    } catch (err) {
      console.error(`Error running pyscript.${scriptKey}:`, err);
      this.results[scriptKey] = {
        success: false,
        error: err.message || err,
        timestamp: new Date().toLocaleTimeString()
      };
    } finally {
      this.loading[scriptKey] = false;
      this.updateCard();
    }
  }

  // Define sizes/properties for Lovelace compatibility
  getCardSize() {
    return 4;
  }
}

// Define the custom element
customElements.define('pyscript-manager-card', PyscriptManagerCard);
window.customCards = window.customCards || [];
window.customCards.push({
  type: "pyscript-manager-card",
  name: "Pyscrypt Manager Card",
  preview: true,
  description: "A gorgeous interface to list, manage and run python automation scripts."
});
