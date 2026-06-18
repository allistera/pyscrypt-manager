/**
 * Pyscrypt Manager Dedicated Sidebar App
 * Registered as a custom panel in Home Assistant.
 */

class PyscryptManagerPanel extends HTMLElement {
  set hass(hass) {
    this._hass = hass;
    if (!this.shadowRoot) {
      this.initPanel();
    }
    this.updatePanel();
  }

  initPanel() {
    this.attachShadow({ mode: 'open' });
    
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          --primary-color: #03a9f4;
          --primary-glow: rgba(3, 169, 244, 0.3);
          --accent-color: #ff9800;
          --success-color: #4caf50;
          --error-color: #f44336;
          --bg-dark: #121214;
          --bg-card: rgba(30, 30, 35, 0.55);
          --border-color: rgba(255, 255, 255, 0.08);
          --font-family: 'Outfit', 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          
          display: block;
          width: 100%;
          height: 100vh;
          background-color: var(--bg-dark);
          color: #e1e1e6;
          font-family: var(--font-family);
          box-sizing: border-box;
          overflow: hidden;
        }

        /* Layout Structure */
        .app-container {
          display: flex;
          height: 100%;
          width: 100%;
          overflow: hidden;
        }

        /* Sidebar Navigation */
        .sidebar {
          width: 260px;
          background: #18181c;
          border-right: 1px solid var(--border-color);
          display: flex;
          flex-direction: column;
          padding: 24px;
          flex-shrink: 0;
          box-sizing: border-box;
          justify-content: space-between;
        }

        .brand-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 32px;
        }

        .logo-container {
          background: linear-gradient(135deg, #306998 0%, #ffd43b 100%);
          width: 40px;
          height: 40px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 15px rgba(48, 105, 152, 0.3);
        }

        .logo-svg {
          width: 24px;
          height: 24px;
        }

        .brand-title h1 {
          margin: 0;
          font-size: 1.15rem;
          font-weight: 700;
          background: linear-gradient(90deg, #fff 0%, #a1a1aa 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .brand-title p {
          margin: 2px 0 0 0;
          font-size: 0.75rem;
          color: #71717a;
        }

        .nav-menu {
          display: flex;
          flex-direction: column;
          gap: 8px;
          flex-grow: 1;
        }

        .nav-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
          font-size: 0.9rem;
          color: #a1a1aa;
          transition: all 0.2s ease;
          user-select: none;
        }

        .nav-item:hover {
          background: rgba(255, 255, 255, 0.04);
          color: #fff;
        }

        .nav-item.active {
          background: rgba(3, 169, 244, 0.1);
          color: var(--primary-color);
          box-shadow: inset 4px 0 0 0 var(--primary-color);
        }

        .nav-icon {
          width: 20px;
          height: 20px;
          fill: currentColor;
        }

        /* Main Workspace */
        .main-workspace {
          flex-grow: 1;
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow: hidden;
          background: radial-gradient(circle at top right, rgba(3, 169, 244, 0.05), transparent 60%);
        }

        /* Top App Bar */
        .top-app-bar {
          height: 64px;
          border-bottom: 1px solid var(--border-color);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 32px;
          background: rgba(18, 18, 20, 0.8);
          backdrop-filter: blur(8px);
          flex-shrink: 0;
        }

        .page-title {
          font-size: 1.2rem;
          font-weight: 700;
          margin: 0;
        }

        .top-bar-actions {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .btn-reload {
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          color: #e1e1e6;
          padding: 8px 16px;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.2s ease;
        }

        .btn-reload:hover {
          background: rgba(255, 255, 255, 0.12);
          border-color: rgba(255, 255, 255, 0.18);
          transform: translateY(-1px);
        }

        .spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          100% { transform: rotate(-360deg); }
        }

        /* Tab Content Containers */
        .tab-content {
          flex-grow: 1;
          display: none;
          overflow: hidden;
          padding: 32px;
          box-sizing: border-box;
        }

        .tab-content.active {
          display: flex;
          gap: 24px;
        }

        /* Scripts Panel Layout */
        .scripts-list-panel {
          width: 380px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          flex-shrink: 0;
        }

        .search-wrapper {
          position: relative;
        }

        .search-input {
          width: 100%;
          background: rgba(0, 0, 0, 0.25);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          padding: 12px 12px 12px 40px;
          color: #fff;
          font-size: 0.9rem;
          font-family: inherit;
          box-sizing: border-box;
          transition: all 0.2s;
        }

        .search-input:focus {
          outline: none;
          border-color: var(--primary-color);
          box-shadow: 0 0 0 3px var(--primary-glow);
        }

        .search-icon {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          width: 18px;
          height: 18px;
          fill: #71717a;
        }

        .filter-tabs {
          display: flex;
          background: rgba(0, 0, 0, 0.2);
          padding: 4px;
          border-radius: 8px;
          border: 1px solid var(--border-color);
        }

        .filter-tab {
          flex-grow: 1;
          text-align: center;
          padding: 8px 12px;
          border-radius: 6px;
          font-size: 0.8rem;
          font-weight: 600;
          color: #a1a1aa;
          cursor: pointer;
          transition: all 0.2s;
          user-select: none;
        }

        .filter-tab.active {
          background: rgba(255, 255, 255, 0.08);
          color: #fff;
        }

        .scripts-scrollable {
          flex-grow: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding-right: 4px;
        }

        /* Custom Scrollbar */
        .scripts-scrollable::-webkit-scrollbar, .panel-body::-webkit-scrollbar, .console-body::-webkit-scrollbar {
          width: 6px;
        }
        .scripts-scrollable::-webkit-scrollbar-track, .panel-body::-webkit-scrollbar-track, .console-body::-webkit-scrollbar-track {
          background: transparent;
        }
        .scripts-scrollable::-webkit-scrollbar-thumb, .panel-body::-webkit-scrollbar-thumb, .console-body::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 3px;
        }

        .script-item-card {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          padding: 16px;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .script-item-card:hover {
          border-color: rgba(255, 255, 255, 0.15);
          transform: translateY(-2px);
          background: rgba(45, 45, 50, 0.6);
        }

        .script-item-card.selected {
          border-color: var(--primary-color);
          background: rgba(3, 169, 244, 0.05);
          box-shadow: 0 0 15px rgba(3, 169, 244, 0.1);
        }

        .script-icon-box {
          width: 40px;
          height: 40px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--primary-color);
          flex-shrink: 0;
        }

        .script-icon-box.system {
          color: var(--accent-color);
        }

        .script-meta {
          min-width: 0;
        }

        .script-title {
          font-weight: 700;
          font-size: 0.95rem;
          margin: 0;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .script-desc {
          margin: 3px 0 0 0;
          font-size: 0.8rem;
          color: #71717a;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* Script Details App-like Drawer Panel */
        .script-details-panel {
          flex-grow: 1;
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: 16px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
        }

        .panel-header {
          padding: 24px;
          border-bottom: 1px solid var(--border-color);
          background: rgba(0, 0, 0, 0.15);
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }

        .panel-header-title h2 {
          margin: 0;
          font-size: 1.3rem;
          font-weight: 700;
        }

        .panel-header-title p {
          margin: 4px 0 0 0;
          font-size: 0.85rem;
          color: #a1a1aa;
        }

        .panel-body {
          flex-grow: 1;
          overflow-y: auto;
          padding: 28px;
        }

        .form-section-title {
          font-size: 0.85rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: #71717a;
          margin: 0 0 20px 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          padding-bottom: 8px;
        }

        /* Form styling */
        .form-group {
          margin-bottom: 20px;
        }

        .form-label {
          display: block;
          font-size: 0.85rem;
          font-weight: 600;
          margin-bottom: 6px;
          color: #e1e1e6;
        }

        .form-label span.required {
          color: var(--error-color);
          margin-left: 2px;
        }

        .form-desc {
          font-size: 0.78rem;
          color: #71717a;
          margin: 0 0 8px 0;
        }

        .field-input {
          width: 100%;
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          padding: 10px 12px;
          color: #fff;
          font-size: 0.85rem;
          font-family: inherit;
          box-sizing: border-box;
          transition: all 0.2s;
        }

        .field-input:focus {
          outline: none;
          border-color: var(--primary-color);
          box-shadow: 0 0 0 2px var(--primary-glow);
        }

        .field-select {
          width: 100%;
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          padding: 10px 12px;
          color: #fff;
          font-size: 0.85rem;
          font-family: inherit;
          box-sizing: border-box;
          cursor: pointer;
        }

        .checkbox-container {
          display: flex;
          align-items: center;
          gap: 12px;
          cursor: pointer;
          user-select: none;
          font-size: 0.85rem;
        }

        .checkbox-input {
          width: 18px;
          height: 18px;
          accent-color: var(--primary-color);
          cursor: pointer;
        }

        .range-container {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .range-slider {
          flex-grow: 1;
          accent-color: var(--primary-color);
        }

        .range-value {
          font-size: 0.9rem;
          font-weight: 700;
          color: var(--primary-color);
          min-width: 40px;
          text-align: right;
        }

        /* Run Console Panel */
        .btn-run {
          background: linear-gradient(135deg, #0288d1 0%, #26c6da 100%);
          border: none;
          color: white;
          padding: 12px 24px;
          font-size: 0.95rem;
          font-weight: 700;
          border-radius: 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 10px;
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
          color: #71717a;
          cursor: not-allowed;
          box-shadow: none;
          transform: none;
        }

        /* Console Output styles */
        .console-panel {
          margin-top: 28px;
          border-radius: 10px;
          background: #0d0e15;
          border: 1px solid var(--border-color);
          overflow: hidden;
          font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
        }

        .console-header {
          background: #141622;
          padding: 10px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          user-select: none;
        }

        .console-title {
          color: #a1a1aa;
          font-weight: 700;
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 1px;
          display: flex;
          align-items: center;
          gap: 8px;
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

        .console-body {
          padding: 16px;
          max-height: 220px;
          overflow-y: auto;
          white-space: pre-wrap;
          font-size: 0.8rem;
          color: #a8ff60;
        }

        .console-body.error {
          color: #ff5f56;
        }

        .console-body.empty {
          color: rgba(255, 255, 255, 0.3);
          font-style: italic;
        }

        /* Empty state placeholders */
        .empty-placeholder {
          flex-grow: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: #71717a;
          text-align: center;
          padding: 48px;
        }

        .placeholder-icon {
          width: 64px;
          height: 64px;
          fill: currentColor;
          margin-bottom: 16px;
          opacity: 0.3;
        }

        .placeholder-title {
          font-size: 1.1rem;
          font-weight: 700;
          margin-bottom: 8px;
          color: #a1a1aa;
        }

        /* Error state */
        .error-overlay {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 64px;
          text-align: center;
          color: #ff8a80;
        }

        .error-icon {
          width: 48px;
          height: 48px;
          fill: currentColor;
          margin-bottom: 16px;
        }

        /* Footer Info */
        .footer-info {
          font-size: 0.75rem;
          color: #52525b;
          text-align: center;
          border-top: 1px solid var(--border-color);
          padding-top: 16px;
          margin-top: 16px;
        }
      </style>

      <div class="app-container">
        <!-- Sidebar Navigation -->
        <div class="sidebar">
          <div>
            <div class="brand-header">
              <div class="logo-container">
                <svg class="logo-svg" viewBox="0 0 110 110">
                  <path fill="#306998" d="M54.2 10.4c-17.6 0-16.5 7.6-16.5 7.6l.1 7.9h16.7v2.3H17.8s-7.6-1.1-7.6 16.5c0 17.6 6.8 16.9 6.8 16.9h4.1v-5.7c0-9.6 8.3-9 8.3-9h16.9c9.3 0 8.6-8.3 8.6-8.3v-17s1.3-11.2-10.7-11.2z"/>
                  <path fill="#ffd43b" d="M54.8 98.6c17.6 0 16.5-7.6 16.5-7.6l-.1-7.9H54.5v-2.3h36.7s7.6 1.1 7.6-16.5c0-17.6-6.8-16.9-6.8-16.9h-4.1v5.7c0 9.6-8.3 9-8.3 9H62.7c-9.3 0-8.6 8.3-8.6 8.3v17s-1.3 11.2 10.7 11.2z"/>
                  <circle cx="28.4" cy="22.2" r="3.2" fill="#fff"/>
                  <circle cx="80.6" cy="86.8" r="3.2" fill="#111"/>
                </svg>
              </div>
              <div class="brand-title">
                <h1>Pyscrypt Manager</h1>
                <p>Dedicated Python App</p>
              </div>
            </div>

            <div class="nav-menu">
              <div class="nav-item active" id="nav-scripts">
                <svg class="nav-icon" viewBox="0 0 24 24">
                  <path d="M12.89,3L14.85,3.4L11.11,21L9.15,20.6L12.89,3M19.59,12L16,8.41V5.58L22.42,12L16,18.41V15.58L19.59,12M1.58,12L8,5.58V8.41L4.41,12L8,15.58V18.41L1.58,12Z" />
                </svg>
                Scripts Manager
              </div>
            </div>
          </div>

          <div class="footer-info">
            Pyscrypt Manager v1.0.0
          </div>
        </div>

        <!-- Main Workspace Area -->
        <div class="main-workspace">
          <div class="top-app-bar">
            <h2 class="page-title" id="page-heading">Scripts Manager</h2>
            <div class="top-bar-actions">
              <button class="btn-reload" id="btn-reload-all">
                <svg class="nav-icon" viewBox="0 0 24 24" style="width:16px;height:16px;">
                  <path d="M17.65,6.35C16.2,4.9 14.21,4 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20C15.73,20 18.84,17.45 19.73,14H17.65C16.83,16.33 14.61,18 12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6C13.66,6 15.14,6.69 16.22,7.78L13,11H20V4L17.65,6.35Z" />
                </svg>
                Reload Pyscripts
              </button>
            </div>
          </div>

          <!-- Scripts Tab Content -->
          <div class="tab-content active" id="content-scripts">
            <div class="scripts-list-panel">
              <div class="search-wrapper">
                <svg class="search-icon" viewBox="0 0 24 24">
                  <path d="M9.5,3A6.5,6.5 0 0,1 16,9.5C16,11.11 15.41,12.59 14.44,13.73L14.71,14H15.5L20.5,19L19,20.5L14,15.5V14.71L13.73,14.44C12.59,15.41 11.11,16 9.5,16A6.5,6.5 0 0,1 3,9.5A6.5,6.5 0 0,1 9.5,3M9.5,5C7,5 5,7 5,9.5C5,12 7,14 9.5,14C12,14 14,12 14,9.5C14,7 12,5 9.5,5Z" />
                </svg>
                <input type="text" class="search-input" id="search-box" placeholder="Search scripts...">
              </div>

              <div class="filter-tabs">
                <div class="filter-tab active" id="filter-all">All</div>
                <div class="filter-tab" id="filter-custom">Custom</div>
                <div class="filter-tab" id="filter-system">System</div>
              </div>

              <div class="scripts-scrollable" id="scripts-list">
                <!-- Populated Dynamically -->
              </div>
            </div>

            <!-- Details Display -->
            <div class="script-details-panel" id="details-container">
              <!-- Rendered Dynamically -->
            </div>
          </div>
        </div>
      </div>
    `;

    // Event Listeners
    this.shadowRoot.getElementById('btn-reload-all').addEventListener('click', () => this.reloadAllPyscripts());
    this.shadowRoot.getElementById('search-box').addEventListener('input', () => this.updatePanel());
    
    // Filter click listeners
    const filters = ['all', 'custom', 'system'];
    filters.forEach(f => {
      this.shadowRoot.getElementById(`filter-${f}`).addEventListener('click', (e) => {
        filters.forEach(filter => this.shadowRoot.getElementById(`filter-${filter}`).classList.remove('active'));
        e.target.classList.add('active');
        this.activeFilter = f;
        this.updatePanel();
      });
    });

    this.activeFilter = 'all';
    this.selectedService = null;
    this.results = {};
    this.loading = {};
  }

  async reloadAllPyscripts() {
    const btn = this.shadowRoot.getElementById('btn-reload-all');
    const svg = btn.querySelector('svg');
    try {
      svg.classList.add('spin');
      btn.disabled = true;
      await this._hass.callService('pyscript', 'reload', {});
      
      btn.style.borderColor = 'var(--success-color)';
      btn.style.color = 'var(--success-color)';
      setTimeout(() => {
        btn.style.borderColor = '';
        btn.style.color = '';
      }, 1500);
    } catch (err) {
      console.error(err);
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

  updatePanel() {
    if (!this._hass) return;

    const pyscriptServices = this._hass.services.pyscript;
    const searchBox = this.shadowRoot.getElementById('search-box');
    const scriptsListEl = this.shadowRoot.getElementById('scripts-list');
    const detailsContainer = this.shadowRoot.getElementById('details-container');

    if (!pyscriptServices) {
      scriptsListEl.innerHTML = `
        <div class="error-overlay">
          <svg class="error-icon" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
          <h3>Pyscript Integration Not Found</h3>
          <p>This dedicated app requires the Pyscript custom component to be installed in Home Assistant.</p>
        </div>
      `;
      detailsContainer.innerHTML = '';
      return;
    }

    const query = searchBox ? searchBox.value.toLowerCase().trim() : '';
    const keys = Object.keys(pyscriptServices).sort();

    let listHtml = '';
    let visibleKeys = [];

    keys.forEach(key => {
      const data = pyscriptServices[key];
      const isSystem = ['reload', 'generate_stubs', 'jupyter_kernel_start'].includes(key);
      const name = data.name || key;

      if (this.activeFilter === 'custom' && isSystem) return;
      if (this.activeFilter === 'system' && !isSystem) return;

      if (query) {
        const matchName = name.toLowerCase().includes(query);
        const matchKey = key.toLowerCase().includes(query);
        const matchDesc = (data.description || '').toLowerCase().includes(query);
        if (!matchName && !matchKey && !matchDesc) return;
      }

      visibleKeys.push(key);
      const isSelected = this.selectedService === key;

      const icon = isSystem
        ? `<svg class="nav-icon" viewBox="0 0 24 24"><path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4M12,6A6,6 0 0,0 6,12A6,6 0 0,0 12,18A6,6 0 0,0 18,12A6,6 0 0,0 12,6M12,8A4,4 0 0,1 16,12A4,4 0 0,1 12,16A4,4 0 0,1 8,12A4,4 0 0,1 12,8Z"/></svg>`
        : `<svg class="nav-icon" viewBox="0 0 24 24"><path d="M12.89,3L14.85,3.4L11.11,21L9.15,20.6L12.89,3M19.59,12L16,8.41V5.58L22.42,12L16,18.41V15.58L19.59,12M1.58,12L8,5.58V8.41L4.41,12L8,15.58V18.41L1.58,12Z"/></svg>`;

      listHtml += `
        <div class="script-item-card ${isSelected ? 'selected' : ''}" data-key="${key}">
          <div class="script-icon-box ${isSystem ? 'system' : ''}">
            ${icon}
          </div>
          <div class="script-meta">
            <h4 class="script-title">
              ${name}
              ${isSystem ? '<span style="font-size:0.65rem; background:rgba(255,152,0,0.15); color:var(--accent-color); padding:2px 6px; border-radius:4px;">System</span>' : ''}
            </h4>
            <p class="script-desc">${data.description || 'No description available'}</p>
          </div>
        </div>
      `;
    });

    scriptsListEl.innerHTML = listHtml;

    // Attach click handlers
    this.shadowRoot.querySelectorAll('.script-item-card').forEach(el => {
      el.addEventListener('click', (e) => {
        const card = e.currentTarget;
        this.selectedService = card.getAttribute('data-key');
        this.updatePanel();
      });
    });

    // Handle detail rendering
    if (this.selectedService && pyscriptServices[this.selectedService]) {
      this.renderDetails(this.selectedService, pyscriptServices[this.selectedService]);
    } else {
      detailsContainer.innerHTML = `
        <div class="empty-placeholder">
          <svg class="placeholder-icon" viewBox="0 0 24 24"><path d="M19,3H5C3.89,3 3,3.89 3,5V19C3,20.1 3.89,21 5,21H19C20.1,21 21,20.1 21,19V5C21,3.89 20.1,3 19,3M19,19H5V5H19V19M11,7H13V9H11V7M11,11H13V17H11V11Z"/></svg>
          <div class="placeholder-title">No Script Selected</div>
          <p style="margin:0; font-size:0.85rem;">Select a script from the list to configure and execute it.</p>
        </div>
      `;
    }

    // Connect slider listeners if details are rendered
    this.shadowRoot.querySelectorAll('.range-slider').forEach(slider => {
      slider.addEventListener('input', (e) => {
        const key = e.target.getAttribute('data-script');
        const field = e.target.getAttribute('data-field');
        const span = this.shadowRoot.getElementById(`val-${key}-${field}`);
        if (span) {
          span.textContent = e.target.value;
        }
      });
    });
  }

  renderDetails(key, data) {
    const detailsContainer = this.shadowRoot.getElementById('details-container');
    const isSystem = ['reload', 'generate_stubs', 'jupyter_kernel_start'].includes(key);

    detailsContainer.innerHTML = `
      <div class="panel-header">
        <div class="panel-header-title">
          <h2>${data.name || key}</h2>
          <p>pyscript.${key}</p>
        </div>
        ${isSystem ? '<span style="font-size:0.75rem; background:rgba(255,152,0,0.15); color:var(--accent-color); padding:4px 8px; border-radius:4px; font-weight:700;">SYSTEM SCRIPT</span>' : ''}
      </div>

      <div class="panel-body">
        <p style="font-size:0.9rem; color:#a1a1aa; margin:0 0 28px 0; line-height:1.5;">${data.description || 'No description available for this python script.'}</p>
        
        <h4 class="form-section-title">Execution Arguments</h4>
        
        <div class="form-fields">
          ${this.renderFields(key, data.fields)}
        </div>

        <div style="margin-top: 24px;">
          <button class="btn-run" id="btn-run-${key}" ${this.loading[key] ? 'disabled' : ''}>
            ${this.loading[key] ? '<div class="spinner"></div>' : `
              <svg viewBox="0 0 24 24" style="width:18px;height:18px;fill:currentColor;"><path d="M8,5.14V19.14L19,12.14L8,5.14Z"/></svg>
            `}
            ${this.loading[key] ? 'Executing script...' : 'Execute Script'}
          </button>
        </div>

        ${this.renderConsole(key)}
      </div>
    `;

    // Attach run trigger
    this.shadowRoot.getElementById(`btn-run-${key}`).addEventListener('click', () => {
      this.executeScript(key, data);
    });
  }

  renderFields(scriptKey, fields) {
    if (!fields || Object.keys(fields).length === 0) {
      return `<p style="font-size:0.85rem; color:#71717a; font-style:italic; margin:0;">This script does not require any parameters.</p>`;
    }

    let html = '';
    Object.keys(fields).forEach(name => {
      const field = fields[name];
      const required = field.required === true;
      const desc = field.description || '';
      const example = field.example ? `Example: ${field.example}` : '';
      const defaultVal = field.default !== undefined ? field.default : '';
      const inputId = `field-${scriptKey}-${name}`;

      let selectorType = 'text';
      let selectOptions = [];
      let min = null, max = null, step = 1;

      if (field.selector) {
        if (field.selector.text) selectorType = 'text';
        else if (field.selector.boolean) selectorType = 'boolean';
        else if (field.selector.select) {
          selectorType = 'select';
          selectOptions = field.selector.select.options || [];
        } else if (field.selector.number) {
          selectorType = 'number';
          min = field.selector.number.min;
          max = field.selector.number.max;
          step = field.selector.number.step || 1;
        }
      } else if (field.type) {
        if (field.type.includes('select')) {
          selectorType = 'select';
          const match = field.type.match(/\(([^)]+)\)/);
          if (match) selectOptions = match[1].split(',').map(o => o.trim());
        } else if (field.type.includes('number')) {
          selectorType = 'number';
          const match = field.type.match(/\(([^)]+)\)/);
          if (match) {
            const range = match[1].split('-');
            if (range.length === 2) {
              min = parseFloat(range[0]);
              max = parseFloat(range[1]);
            }
          }
        } else if (field.type.includes('boolean')) {
          selectorType = 'boolean';
        }
      }

      html += `<div class="form-group">
        <label class="form-label">${field.name || name} ${required ? '<span class="required">*</span>' : ''}</label>
        ${desc ? `<p class="form-desc">${desc}</p>` : ''}
      `;

      if (selectorType === 'boolean') {
        html += `
          <label class="checkbox-container">
            <input type="checkbox" class="checkbox-input" id="${inputId}" ${defaultVal ? 'checked' : ''}>
            <span>Enable</span>
          </label>
        `;
      } else if (selectorType === 'select') {
        html += `
          <select class="field-select" id="${inputId}">
            ${selectOptions.map(opt => `<option value="${opt}" ${opt === defaultVal ? 'selected' : ''}>${opt}</option>`).join('')}
          </select>
        `;
      } else if (selectorType === 'number' && min !== null && max !== null) {
        html += `
          <div class="range-container">
            <input type="range" class="range-slider" id="${inputId}" min="${min}" max="${max}" step="${step}" value="${defaultVal !== '' ? defaultVal : min}" data-script="${scriptKey}" data-field="${name}">
            <span class="range-value" id="val-${scriptKey}-${name}">${defaultVal !== '' ? defaultVal : min}</span>
          </div>
        `;
      } else if (selectorType === 'number') {
        html += `<input type="number" class="field-input" id="${inputId}" value="${defaultVal}">`;
      } else {
        html += `<input type="text" class="field-input" id="${inputId}" value="${defaultVal}" placeholder="${example}">`;
      }

      html += `</div>`;
    });

    return html;
  }

  renderConsole(key) {
    const res = this.results[key];
    let iconClass = '';
    let title = 'Console Idle';
    let content = 'Ready for script execution...';
    let time = '';

    if (this.loading[key]) {
      title = 'Running';
      content = 'Running script on Home Assistant event bus...\n';
    } else if (res) {
      title = res.success ? 'Success' : 'Failed';
      iconClass = res.success ? 'success' : '';
      time = `<span style="font-size:0.7rem; color:rgba(255,255,255,0.4);">${res.time}</span>`;
      
      if (res.success) {
        content = res.data ? `Script finished successfully.\n\nResponse Payload:\n${JSON.stringify(res.data, null, 2)}` : 'Script executed successfully. Returned no output data.';
      } else {
        content = `Execution failed with error:\n${res.error}`;
      }
    }

    return `
      <div class="console-panel">
        <div class="console-header">
          <div class="console-title">
            <span class="console-dot ${iconClass}"></span>
            ${title}
          </div>
          ${time}
        </div>
        <div class="console-body ${!res && !this.loading[key] ? 'empty' : ''} ${res && !res.success ? 'error' : ''}">
          ${content}
        </div>
      </div>
    `;
  }

  async executeScript(scriptKey, serviceData) {
    const fields = serviceData.fields || {};
    const params = {};

    Object.keys(fields).forEach(name => {
      const field = fields[name];
      const el = this.shadowRoot.getElementById(`field-${scriptKey}-${name}`);
      if (!el) return;

      let value;
      if (el.type === 'checkbox') {
        value = el.checked;
      } else if (el.type === 'range' || el.type === 'number') {
        value = parseFloat(el.value);
        if (isNaN(value)) value = undefined;
      } else {
        value = el.value;
        if (value === '' && !field.required) value = undefined;
      }

      if (value !== undefined) {
        params[name] = value;
      }
    });

    try {
      this.loading[scriptKey] = true;
      this.updatePanel();

      const response = await this._hass.callService('pyscript', scriptKey, params, undefined, true);

      this.results[scriptKey] = {
        success: true,
        data: response,
        time: new Date().toLocaleTimeString()
      };
    } catch (err) {
      console.error(err);
      this.results[scriptKey] = {
        success: false,
        error: err.message || err,
        time: new Date().toLocaleTimeString()
      };
    } finally {
      this.loading[scriptKey] = false;
      this.updatePanel();
    }
  }
}

customElements.define('pyscrypt-manager-panel', PyscryptManagerPanel);
