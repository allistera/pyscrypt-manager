/**
 * Pyscrypt Manager Dedicated Three-Column Workspace App
 * Registered as a custom panel in Home Assistant.
 * Fully customized for Dynatrace (light/dark) look and feel.
 */

class PyscryptManagerPanel extends HTMLElement {
  set hass(hass) {
    this._hass = hass;
    
    // Theme detection for Dynatrace theme variables
    const useDark = hass.themes && hass.themes.darkMode !== undefined
      ? hass.themes.darkMode
      : window.matchMedia('(prefers-color-scheme: dark)').matches;
    this.setAttribute('theme', useDark ? 'dark' : 'light');

    if (!this.shadowRoot) {
      this.initPanel();
      this.loadFiles();
    } else {
      this.updatePanel();
    }
  }

  constructor() {
    super();
    this.files = [];
    this.selectedFilePath = null;
    this.selectedFileContent = '';
    this.selectedFileOriginalContent = '';
    this.isEditing = false;
    this.activeTab = 'visual'; // 'visual' or 'code'
    
    // Filters
    this.selectedFolder = null; // folder string or null
    this.searchQuery = '';
    this.expandedFolders = {}; // path string -> boolean (true = expanded)

    // Console output log
    this.consoleLogs = [];
  }

  async loadFiles() {
    try {
      this.files = await this._hass.callWS({
        type: 'pyscrypt_manager/list_files'
      });
      this.updatePanel();
    } catch (err) {
      console.error('Failed to load files:', err);
    }
  }

  async selectFile(filePath) {
    if (this.isEditing && this.selectedFileContent !== this.selectedFileOriginalContent) {
      if (!confirm('You have unsaved changes. Discard them?')) {
        return;
      }
    }

    this.selectedFilePath = filePath;
    this.isEditing = false;
    this.consoleLogs = [];

    if (filePath) {
      try {
        const result = await this._hass.callWS({
          type: 'pyscrypt_manager/get_file',
          path: filePath
        });
        this.selectedFileContent = result.content;
        this.selectedFileOriginalContent = result.content;
      } catch (err) {
        console.error('Failed to load file content:', err);
        this.selectedFileContent = `# Error loading file: ${err.message || err}`;
        this.selectedFileOriginalContent = this.selectedFileContent;
      }
    } else {
      this.selectedFileContent = '';
      this.selectedFileOriginalContent = '';
    }

    this.updatePanel();
  }

  async saveFile() {
    if (!this.selectedFilePath) return;
    
    const textarea = this.shadowRoot.getElementById('code-textarea');
    if (textarea) {
      this.selectedFileContent = textarea.value;
    }

    try {
      const btn = this.shadowRoot.getElementById('btn-save');
      if (btn) btn.disabled = true;

      await this._hass.callWS({
        type: 'pyscrypt_manager/save_file',
        path: this.selectedFilePath,
        content: this.selectedFileContent
      });

      this.selectedFileOriginalContent = this.selectedFileContent;
      this.isEditing = false;
      this.logToConsole('System', 'File saved successfully.', 'success');
      
      // Reload file list in background to pick up any metadata changes
      await this.loadFiles();
    } catch (err) {
      this.logToConsole('System', `Failed to save file: ${err.message || err}`, 'error');
    } finally {
      const btn = this.shadowRoot.getElementById('btn-save');
      if (btn) btn.disabled = false;
      this.updatePanel();
    }
  }

  async reloadPyscripts() {
    const btn = this.shadowRoot.getElementById('btn-reload-pyscripts');
    const svg = btn ? btn.querySelector('svg') : null;
    if (btn) btn.disabled = true;
    if (svg) svg.classList.add('spin');

    this.logToConsole('System', 'Triggering Pyscript engine reload...', 'info');
    try {
      await this._hass.callService('pyscript', 'reload', {});
      this.logToConsole('System', 'Pyscript reload triggered. Allow a few seconds for services to re-register.', 'success');
      
      // Reload files after a short delay
      setTimeout(async () => {
        await this.loadFiles();
      }, 2000);
    } catch (err) {
      this.logToConsole('System', `Reload service call failed: ${err.message || err}`, 'error');
    } finally {
      if (btn) btn.disabled = false;
      if (svg) svg.classList.remove('spin');
    }
  }

  async createNewScript() {
    const scriptPath = prompt('Enter new script path relative to pyscript folder (e.g. "my_script.py" or "heating/my_control.py"):');
    if (!scriptPath) return;

    let path = scriptPath.trim();
    if (!path.endsWith('.py')) path += '.py';

    const boilerplate = `# A newly created custom pyscript

@service
def ${path.split('/').pop().replace('.py', '')}():
    """My custom pyscript service."""
    log.info("Running custom pyscript service")
`;

    try {
      await this._hass.callWS({
        type: 'pyscrypt_manager/save_file',
        path: path,
        content: boilerplate
      });

      // Reload files list
      await this.loadFiles();
      // Select new file
      await this.selectFile(path);
      // Trigger a reload so it becomes immediately callable
      await this.reloadPyscripts();
    } catch (err) {
      alert(`Failed to create file: ${err.message || err}`);
    }
  }

  getServiceKey(filePath) {
    if (!filePath) return '';
    const base = filePath.replace(/\.py$/, '');
    return base.replace(/[\/\\]/g, '_');
  }

  logToConsole(source, message, type = 'info') {
    const time = new Date().toLocaleTimeString();
    this.consoleLogs.push({ time, source, message, type });
    this.renderConsole();
  }

  renderConsole() {
    const container = this.shadowRoot.getElementById('console-output');
    if (!container) return;
    
    if (this.consoleLogs.length === 0) {
      container.innerHTML = `<div style="color:var(--text-muted);">Console ready. Trigger script execution...</div>`;
      return;
    }

    container.innerHTML = this.consoleLogs.map(log => {
      let color = 'var(--text-muted)';
      if (log.type === 'success') color = 'var(--success-color)';
      if (log.type === 'error') color = 'var(--error-color)';
      if (log.type === 'info') color = 'var(--primary-color)';

      return `<div style="margin-bottom:6px; font-family:monospace; font-size:0.85rem; line-height:1.4;">
        <span style="color:var(--text-muted); font-size:0.75rem;">[${log.time}]</span> 
        <span style="color:${color}; font-weight:600;">[${log.source}]</span> 
        <span style="color:var(--text-main); white-space:pre-wrap;">${log.message}</span>
      </div>`;
    }).join('');

    container.scrollTop = container.scrollHeight;
  }

  async runScript(serviceKey, fields) {
    this.logToConsole('Client', `Executing pyscript.${serviceKey}...`, 'info');
    
    // Gather arguments
    const params = {};
    if (fields) {
      for (const fieldKey of Object.keys(fields)) {
        const input = this.shadowRoot.getElementById(`field-${serviceKey}-${fieldKey}`);
        if (input) {
          let val = input.value;
          if (input.type === 'checkbox') {
            val = input.checked;
          } else if (input.type === 'number' || input.className.includes('range-slider')) {
            val = Number(val);
          }
          params[fieldKey] = val;
        }
      }
    }

    this.logToConsole('Client', `Parameters sent: ${JSON.stringify(params)}`, 'info');

    try {
      const response = await this._hass.callService('pyscript', serviceKey, params, undefined, true);
      this.logToConsole('Service Result', `Success! Call response: ${JSON.stringify(response)}`, 'success');
    } catch (err) {
      this.logToConsole('Service Result', `Error: ${err.message || err}`, 'error');
    }
  }

  initPanel() {
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          /* Default to Dark Theme (Dynatrace Strato Dark) */
          --bg-dark: #141419;
          --bg-sidebar: #1f1f24;
          --bg-middle: #1f1f24;
          --border-color: #2a2a30;
          --primary-color: #1496ff;
          --primary-hover: rgba(20, 150, 255, 0.1);
          --primary-glow: rgba(20, 150, 255, 0.35);
          --text-main: #f0f0f5;
          --text-muted: #9595a5;
          --font-family: 'Outfit', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          --card-bg: #1f1f24;
          --card-selected-bg: rgba(20, 150, 255, 0.08);
          --success-color: #00c6b7;
          --error-color: #e01a4f;
          --search-bg: #141419;
          --console-bg: #141419;
          --console-text: #f0f0f5;
          --editor-bg: #141419;
          --editor-lines-bg: #1f1f24;
          --editor-lines-text: #5c5c70;
          --editor-text: #f0f0f5;
          --btn-secondary-bg: #2a2a30;
          --btn-secondary-hover: rgba(255, 255, 255, 0.05);
          --btn-secondary-text: #f0f0f5;

          /* Dark theme syntax colors */
          --hl-comment: #7c7c90;
          --hl-string: #00c6b7;
          --hl-keyword: #1496ff;
          --hl-decorator: #b8bbff;
          --hl-function: #fbbf24;
          --hl-builtin: #f0f0f5;
          --hl-number: #f59e0b;
          
          display: block;
          width: 100%;
          height: 100vh;
          background-color: var(--bg-dark);
          color: var(--text-main);
          font-family: var(--font-family);
          box-sizing: border-box;
          overflow: hidden;
        }

        :host([theme="light"]) {
          /* Light Theme (Dynatrace Strato Light) */
          --bg-dark: #f2f2f5;
          --bg-sidebar: #ffffff;
          --bg-middle: #ffffff;
          --border-color: #e6e6ea;
          --primary-color: #1496ff;
          --primary-hover: rgba(20, 150, 255, 0.08);
          --primary-glow: rgba(20, 150, 255, 0.2);
          --text-main: #2d2e4e;
          --text-muted: #6f7090;
          --card-bg: #ffffff;
          --card-selected-bg: rgba(20, 150, 255, 0.05);
          --success-color: #00c6b7;
          --error-color: #e01a4f;
          --search-bg: #f2f2f5;
          --console-bg: #f2f2f5;
          --console-text: #2d2e4e;
          --editor-bg: #ffffff;
          --editor-lines-bg: #f2f2f5;
          --editor-lines-text: #9595a5;
          --editor-text: #2d2e4e;
          --btn-secondary-bg: #f2f2f5;
          --btn-secondary-hover: rgba(0, 0, 0, 0.04);
          --btn-secondary-text: #2d2e4e;

          /* Light theme syntax colors */
          --hl-comment: #8c8c9e;
          --hl-string: #00877a;
          --hl-keyword: #0066cc;
          --hl-decorator: #5e35b1;
          --hl-function: #d84315;
          --hl-builtin: #2d2e4e;
          --hl-number: #e65100;
        }

        /* Syntax Highlight Classes */
        .hl-comment { color: var(--hl-comment); font-style: italic; }
        .hl-string { color: var(--hl-string); }
        .hl-keyword { color: var(--hl-keyword); font-weight: 600; }
        .hl-decorator { color: var(--hl-decorator); }
        .hl-function { color: var(--hl-function); }
        .hl-builtin { color: var(--hl-builtin); font-weight: 600; }
        .hl-number { color: var(--hl-number); }

        .app-layout {
          display: flex;
          width: 100%;
          height: 100%;
          overflow: hidden;
        }

        /* Column 1: Left Navigation Sidebar */
        .left-sidebar {
          width: 260px;
          background: var(--bg-sidebar);
          border-right: 1px solid var(--border-color);
          display: flex;
          flex-direction: column;
          padding: 20px;
          flex-shrink: 0;
          box-sizing: border-box;
          overflow-y: auto;
        }

        .brand-section {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 24px;
          flex-shrink: 0;
        }

        .logo-box {
          background: linear-gradient(135deg, #306998 0%, #ffd43b 100%);
          width: 34px;
          height: 34px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px rgba(48, 105, 152, 0.25);
        }

        .logo-img {
          width: 20px;
          height: 20px;
        }

        .brand-name h1 {
          margin: 0;
          font-size: 1.05rem;
          font-weight: 700;
          color: var(--text-main);
        }

        .brand-name p {
          margin: 2px 0 0 0;
          font-size: 0.7rem;
          color: var(--text-muted);
        }

        .section-header {
          font-size: 0.72rem;
          font-weight: 700;
          color: var(--text-muted);
          letter-spacing: 0.08em;
          margin: 24px 0 10px 0;
          display: flex;
          justify-content: space-between;
          align-items: center;
          text-transform: uppercase;
        }

        .nav-list {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .nav-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 12px;
          border-radius: 6px;
          cursor: pointer;
          color: var(--text-muted);
          font-size: 0.85rem;
          transition: all 0.2s;
          user-select: none;
        }

        .nav-item:hover {
          background: var(--primary-hover);
          color: var(--text-main);
        }

        .nav-item.active {
          background: var(--primary-hover);
          color: var(--text-main);
          font-weight: 600;
          box-shadow: inset 3px 0 0 0 var(--primary-color);
        }

        .nav-item .badge {
          background: var(--border-color);
          color: var(--text-muted);
          font-size: 0.72rem;
          padding: 2px 6px;
          border-radius: 10px;
          min-width: 14px;
          text-align: center;
        }

        .nav-item.active .badge {
          background: var(--primary-color);
          color: #fff;
        }

        .caret-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 14px;
          height: 14px;
          margin-right: 4px;
          cursor: pointer;
          color: var(--text-muted);
          transition: transform 0.2s, color 0.2s;
        }

        .caret-icon:hover {
          color: var(--text-main);
        }

        .caret-icon.expanded {
          transform: rotate(90deg);
        }

        .caret-spacer {
          display: inline-block;
          width: 18px;
          height: 14px;
        }

        .folder-icon {
          display: inline-flex;
          align-items: center;
          color: var(--primary-color);
        }

        .folder-name-label {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .folder-children-container {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        /* Column 2: Middle Filtered List */
        .middle-panel {
          width: 320px;
          background: var(--bg-middle);
          border-right: 1px solid var(--border-color);
          display: flex;
          flex-direction: column;
          flex-shrink: 0;
          box-sizing: border-box;
        }

        .search-container {
          display: flex;
          gap: 8px;
          padding: 16px;
          border-bottom: 1px solid var(--border-color);
          flex-shrink: 0;
        }

        .search-wrap {
          flex-grow: 1;
          display: flex;
          align-items: center;
          background: var(--search-bg);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          padding: 0 10px;
          height: 36px;
        }

        .search-icon {
          width: 16px;
          height: 16px;
          fill: var(--text-muted);
          margin-right: 8px;
        }

        .search-input {
          background: transparent;
          border: none;
          color: var(--text-main);
          outline: none;
          width: 100%;
          font-size: 0.85rem;
        }

        .btn-add {
          background: var(--primary-color);
          border: none;
          border-radius: 8px;
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          cursor: pointer;
          box-shadow: 0 3px 8px var(--primary-glow);
          transition: background 0.2s;
        }

        .btn-add:hover {
          opacity: 0.9;
        }

        .list-scrollable {
          flex-grow: 1;
          overflow-y: auto;
        }

        .script-card {
          display: flex;
          align-items: flex-start;
          padding: 14px 16px;
          border-bottom: 1px solid var(--border-color);
          cursor: pointer;
          transition: all 0.2s;
        }

        .script-card:hover {
          background: var(--primary-hover);
        }

        .script-card.selected {
          background: var(--card-selected-bg);
          box-shadow: inset 4px 0 0 0 var(--primary-color);
        }

        .status-indicator {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          margin-top: 5px;
          margin-right: 12px;
          flex-shrink: 0;
        }

        .status-indicator.active { background: var(--success-color); }
        .status-indicator.inactive { background: var(--text-muted); }

        .script-meta {
          flex-grow: 1;
          min-width: 0;
        }

        .card-header-row {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          margin: 0;
        }

        .card-title {
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--text-main);
          margin: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .card-time {
          font-size: 0.72rem;
          color: var(--text-muted);
          flex-shrink: 0;
          margin-left: 8px;
        }

        /* Column 3: Right workspace area */
        .right-workspace {
          flex-grow: 1;
          background: var(--bg-dark);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        /* Top Workspace Bar (matching the screenshot header tabs) */
        .workspace-header {
          height: 64px;
          border-bottom: 1px solid var(--border-color);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 24px;
          background: var(--bg-sidebar);
          flex-shrink: 0;
        }

        .workspace-title-info {
          display: flex;
          flex-direction: column;
        }

        .workspace-title {
          font-size: 0.95rem;
          font-weight: 700;
          margin: 0;
          color: var(--text-main);
        }

        .workspace-subtitle {
          font-size: 0.72rem;
          color: var(--text-muted);
          margin: 2px 0 0 0;
        }

        .workspace-controls {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        /* Toggle Button Group (Visual / Code) */
        .toggle-group {
          display: flex;
          background: var(--search-bg);
          border-radius: 6px;
          padding: 2px;
        }

        .toggle-btn {
          border: none;
          background: transparent;
          color: var(--text-muted);
          padding: 6px 14px;
          border-radius: 4px;
          font-size: 0.78rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .toggle-btn.active {
          background: var(--primary-color);
          color: #fff;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
        }

        .action-icon-btn {
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          padding: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          transition: all 0.2s;
        }

        .action-icon-btn:hover {
          color: var(--text-main);
          background: var(--primary-hover);
        }

        .workspace-scrollable {
          flex-grow: 1;
          overflow-y: auto;
          padding: 24px;
          box-sizing: border-box;
        }

        /* Empty state (matching visual style of the screenshot) */
        .empty-workspace-state {
          flex-grow: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: var(--text-muted);
          padding: 40px;
        }

        .empty-icon-box {
          margin-bottom: 20px;
          color: var(--primary-hover);
        }

        .empty-heading {
          font-size: 1.1rem;
          font-weight: 600;
          color: var(--text-main);
          margin: 0 0 6px 0;
        }

        .empty-text {
          font-size: 0.82rem;
          margin: 0;
          color: var(--text-muted);
          text-align: center;
          max-width: 300px;
          line-height: 1.4;
        }

        /* Code Editor Tab */
        .editor-workspace {
          display: flex;
          flex-direction: column;
          height: 100%;
        }

        .code-editor-container {
          flex-grow: 1;
          display: flex;
          background: var(--editor-bg);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          overflow: hidden;
          font-family: 'Fira Code', 'Courier New', Courier, monospace;
          font-size: 0.85rem;
          position: relative;
        }

        .line-numbers {
          padding: 16px 10px;
          background: var(--editor-lines-bg);
          border-right: 1px solid var(--border-color);
          color: var(--editor-lines-text);
          text-align: right;
          user-select: none;
          overflow-y: hidden;
          display: flex;
          flex-direction: column;
          line-height: 1.5;
          font-family: 'Fira Code', 'Courier New', Courier, monospace;
          font-size: 0.85rem;
        }

        .line-numbers div {
          line-height: 1.5;
        }

        .code-editor-wrapper {
          position: relative;
          flex-grow: 1;
          display: flex;
          background: var(--editor-bg);
          overflow: hidden;
        }

        .highlight-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          margin: 0;
          padding: 16px;
          box-sizing: border-box;
          pointer-events: none;
          white-space: pre;
          overflow: hidden;
          font-family: 'Fira Code', 'Courier New', Courier, monospace;
          font-size: 0.85rem;
          line-height: 1.5;
          color: var(--editor-text);
          background: transparent;
        }

        .code-textarea {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          margin: 0;
          padding: 16px;
          box-sizing: border-box;
          background: transparent;
          border: none;
          color: transparent;
          caret-color: var(--text-main);
          line-height: 1.5;
          font-family: 'Fira Code', 'Courier New', Courier, monospace;
          font-size: 0.85rem;
          resize: none;
          outline: none;
          overflow: auto;
          white-space: pre;
          word-break: normal;
        }

        .editor-actions-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 16px;
          flex-shrink: 0;
        }

        .editor-status {
          font-size: 0.75rem;
          color: var(--text-muted);
        }

        .editor-buttons {
          display: flex;
          gap: 12px;
        }

        .btn-action-primary {
          background: var(--primary-color);
          border: none;
          color: #fff;
          font-weight: 600;
          font-size: 0.8rem;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          transition: background 0.2s;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .btn-action-primary:hover {
          opacity: 0.9;
        }

        .btn-action-primary:disabled {
          background: var(--border-color);
          color: var(--text-muted);
          cursor: not-allowed;
        }

        .btn-action-secondary {
          background: var(--btn-secondary-bg);
          border: 1px solid var(--border-color);
          color: var(--btn-secondary-text);
          font-weight: 600;
          font-size: 0.8rem;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-action-secondary:hover {
          background: var(--btn-secondary-hover);
          color: var(--text-main);
        }

        /* Visual Cockpit / Form Execution Tab */
        .visual-cockpit {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .card-panel {
          background: var(--bg-sidebar);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          padding: 20px;
        }

        .panel-heading {
          font-size: 0.85rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--text-main);
          margin: 0 0 16px 0;
          border-bottom: 1px solid var(--border-color);
          padding-bottom: 10px;
        }

        .form-row {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-bottom: 16px;
        }

        .form-label {
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--text-main);
        }

        .form-input-text {
          background: var(--search-bg);
          border: 1px solid var(--border-color);
          color: var(--text-main);
          padding: 8px 12px;
          border-radius: 6px;
          font-size: 0.85rem;
          outline: none;
        }

        .form-input-text:focus {
          border-color: var(--primary-color);
        }

        .range-slider-wrapper {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .range-slider {
          flex-grow: 1;
          accent-color: var(--primary-color);
        }

        .slider-val {
          font-family: monospace;
          font-size: 0.85rem;
          color: var(--text-main);
          min-width: 32px;
        }

        .checkbox-wrapper {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 4px;
        }

        .checkbox-input {
          accent-color: var(--primary-color);
          width: 16px;
          height: 16px;
          cursor: pointer;
        }

        /* Console styling */
        .console-container {
          display: flex;
          flex-direction: column;
          background: var(--console-bg);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          height: 240px;
          overflow: hidden;
        }

        .console-header {
          background: var(--bg-sidebar);
          padding: 8px 16px;
          border-bottom: 1px solid var(--border-color);
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 0.72rem;
          font-weight: 700;
          color: var(--text-muted);
          text-transform: uppercase;
        }

        .console-body {
          flex-grow: 1;
          padding: 16px;
          overflow-y: auto;
        }

        /* Utils */
        .spin {
          animation: spin-anim 1s linear infinite;
        }

        @keyframes spin-anim {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>

      <div class="app-layout">
        <!-- Column 1: Left Navigation Sidebar -->
        <div class="left-sidebar">
          <div class="brand-section">
            <div class="logo-box">
              <svg class="logo-img" viewBox="0 0 110 110">
                <path fill="#306998" d="M54.2 10.4c-17.6 0-16.5 7.6-16.5 7.6l.1 7.9h16.7v2.3H17.8s-7.6-1.1-7.6 16.5c0 17.6 6.8 16.9 6.8 16.9h4.1v-5.7c0-9.6 8.3-9 8.3-9h16.9c9.3 0 8.6-8.3 8.6-8.3v-17s1.3-11.2-10.7-11.2z"/>
                <path fill="#ffd43b" d="M54.8 98.6c17.6 0 16.5-7.6 16.5-7.6l-.1-7.9H54.5v-2.3h36.7s7.6 1.1 7.6-16.5c0-17.6-6.8-16.9-6.8-16.9h-4.1v5.7c0 9.6-8.3 9-8.3 9H62.7c-9.3 0-8.6 8.3-8.6 8.3v17s-1.3 11.2 10.7 11.2z"/>
                <circle cx="28.4" cy="22.2" r="3.2" fill="#fff"/>
                <circle cx="80.6" cy="86.8" r="3.2" fill="#111"/>
              </svg>
            </div>
            <div class="brand-name">
              <h1>Pyscrypt Manager</h1>
              <p>Cockpit &amp; Code Editor</p>
            </div>
          </div>

          <!-- Folders -->
          <div class="section-header">
            <span>Folders</span>
          </div>
          <div class="nav-list" id="folders-nav-list">
            <!-- Populated dynamically -->
          </div>
        </div>

        <!-- Column 2: Middle Filtered List -->
        <div class="middle-panel">
          <div class="search-container">
            <div class="search-wrap">
              <svg class="search-icon" viewBox="0 0 24 24">
                <path d="M9.5,3A6.5,6.5 0 0,1 16,9.5C16,11.11 15.41,12.59 14.44,13.73L14.71,14H15.5L20.5,19L19,20.5L14,15.5V14.71L13.73,14.44C12.59,15.41 11.11,16 9.5,16A6.5,6.5 0 0,1 3,9.5A6.5,6.5 0 0,1 9.5,3M9.5,5C7,5 5,7 5,9.5C5,12 7,14 9.5,14C12,14 14,12 14,9.5C14,7 12,5 9.5,5Z"/>
              </svg>
              <input type="text" class="search-input" id="search-box" placeholder="Search scripts...">
            </div>
            <button class="btn-add" id="btn-create-script" title="Create new script file">
              <svg style="width:20px;height:20px;" viewBox="0 0 24 24">
                <path fill="currentColor" d="M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z"/>
              </svg>
            </button>
          </div>

          <div class="list-scrollable" id="scripts-list">
            <!-- Dynamic cards -->
          </div>
        </div>

        <!-- Column 3: Right Workspace Editor/Cockpit -->
        <div class="right-workspace" id="right-workspace">
          <!-- Populated by showWorkspace() -->
        </div>
      </div>
    `;

    // Event Listeners for search & creation
    this.shadowRoot.getElementById('search-box').addEventListener('input', (e) => {
      this.searchQuery = e.target.value.toLowerCase().trim();
      this.updatePanel();
    });

    this.shadowRoot.getElementById('btn-create-script').addEventListener('click', () => {
      this.createNewScript();
    });
  }

  updateSidebarActiveStates() {
    this.shadowRoot.querySelectorAll('.nav-item').forEach(el => {
      el.classList.remove('active');
    });

    if (this.selectedFolder !== null) {
      const el = this.shadowRoot.querySelector(`[data-folder-path="${this.selectedFolder}"]`);
      if (el) el.classList.add('active');
    }
  }

  renderFolderNode(node, depth = 0) {
    const isExpanded = this.expandedFolders[node.path] !== false;
    const hasChildren = Object.keys(node.children).length > 0;
    
    // Determine active state
    // If selectedFolder is null/empty, the root node (node.path === '') is active
    const isSelected = (this.selectedFolder === null && node.path === '') || (this.selectedFolder === node.path);
    
    const indent = depth * 12;
    
    const caret = hasChildren
      ? `<span class="caret-icon ${isExpanded ? 'expanded' : ''}" data-toggle-path="${node.path}">
           <svg style="width:14px;height:14px;vertical-align:middle;" viewBox="0 0 24 24">
             <path fill="currentColor" d="M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,16.58Z"/>
           </svg>
         </span>`
      : `<span class="caret-spacer"></span>`;

    const folderIcon = `
      <span class="folder-icon">
        <svg style="width:16px;height:16px;vertical-align:middle;margin-right:6px;" viewBox="0 0 24 24">
          <path fill="currentColor" d="M10,4H4C2.89,4 2,4.89 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V8C22,6.89 21.1,6 20,6H12L10,4Z"/>
        </svg>
      </span>`;

    let html = `
      <div class="nav-item ${isSelected ? 'active' : ''}" style="padding-left: ${indent}px;" data-folder-path="${node.path}">
        <div style="display:flex; align-items:center; flex-grow:1; min-width:0;">
          ${caret}
          ${folderIcon}
          <span class="folder-name-label">${node.name}</span>
        </div>
        <span class="badge">${node.count}</span>
      </div>
    `;

    if (hasChildren && isExpanded) {
      html += `<div class="folder-children-container">`;
      Object.keys(node.children).sort().forEach(childName => {
        html += this.renderFolderNode(node.children[childName], depth + 1);
      });
      html += `</div>`;
    }

    return html;
  }

  updatePanel() {
    if (!this._hass) return;

    const pyscriptServices = this._hass.services.pyscript || {};
    
    // 1. Process files list & calculate sidebar aggregates (filtering out system scripts)
    const customFiles = this.files.filter(file => {
      const serviceKey = this.getServiceKey(file.path);
      const isSystem = ['reload', 'generate_stubs', 'jupyter_kernel_start'].includes(serviceKey);
      return !isSystem;
    });

    // Build hierarchical tree
    const rootNode = { name: 'PyScript Folder', path: '', children: {}, count: 0 };
    customFiles.forEach(file => {
      const parts = file.path.split('/');
      parts.pop(); // remove filename
      
      let currentNode = rootNode;

      let currentPath = '';
      parts.forEach(part => {
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        if (!currentNode.children[part]) {
          currentNode.children[part] = {
            name: part,
            path: currentPath,
            children: {},
            count: 0
          };
        }
        currentNode = currentNode.children[part];
      });
      currentNode.count++;
    });

    // Render Folders Tree Navigation List
    const foldersNav = this.shadowRoot.getElementById('folders-nav-list');
    if (foldersNav) {
      foldersNav.innerHTML = this.renderFolderNode(rootNode, 0);

      // Bind events
      foldersNav.querySelectorAll('.nav-item').forEach(el => {
        el.addEventListener('click', (e) => {
          const folderPath = el.getAttribute('data-folder-path');
          
          // Check if the click was on the caret-icon
          const caret = e.target.closest('.caret-icon');
          if (caret) {
            e.stopPropagation();
            const path = caret.getAttribute('data-toggle-path');
            this.expandedFolders[path] = this.expandedFolders[path] === false ? true : false;
            this.updatePanel();
            return;
          }

          // Toggle folder selection
          const targetFolder = folderPath;
          if (this.selectedFolder === targetFolder) {
            this.selectedFolder = null;
          } else {
            this.selectedFolder = targetFolder;
          }
          this.updateSidebarActiveStates();
          this.updatePanel();
        });
      });
    }

    // 2. Filter & Render Middle List Cards
    const scriptsListEl = this.shadowRoot.getElementById('scripts-list');
    let listHtml = '';

    // Merge actual physical files and loose registered services (e.g. system commands)
    const displayList = [];

    // Add physical files
    customFiles.forEach(file => {
      const serviceKey = this.getServiceKey(file.path);
      const data = pyscriptServices[serviceKey] || {};

      displayList.push({
        type: 'file',
        path: file.path,
        name: file.name,
        serviceKey: serviceKey,
        mtime: file.mtime,
        size: file.size,
        status: data ? 'active' : 'inactive' // active if loaded by HA core, else inactive
      });
    });

    // Add loose services (e.g. custom services not backed by files)
    Object.keys(pyscriptServices).forEach(key => {
      const isSystem = ['reload', 'generate_stubs', 'jupyter_kernel_start'].includes(key);
      if (isSystem) return; // exclude system/built-in services completely

      const hasFile = displayList.some(item => item.serviceKey === key);
      if (!hasFile) {
        displayList.push({
          type: 'service',
          path: null,
          name: key,
          serviceKey: key,
          mtime: null,
          size: 0,
          status: 'active'
        });
      }
    });

    // Filter displaying list
    const filteredList = displayList.filter(item => {
      // Search Box Filter
      if (this.searchQuery) {
        const matchName = item.name.toLowerCase().includes(this.searchQuery);
        const matchKey = item.serviceKey.toLowerCase().includes(this.searchQuery);
        if (!matchName && !matchKey) return false;
      }

      // Folder Sidebar filter (only show scripts directly in selected folder)
      if (this.selectedFolder !== null) {
        if (!item.path) return false;
        const parts = item.path.split('/');
        parts.pop(); // remove filename
        const itemFolder = parts.join('/');
        if (itemFolder !== this.selectedFolder) {
          return false;
        }
      }

      return true;
    });

    // Sort: custom scripts sorted alphabetically
    filteredList.sort((a, b) => a.name.localeCompare(b.name));

    if (filteredList.length === 0) {
      listHtml = `<div style="color:var(--text-muted); padding:32px 16px; text-align:center; font-size:0.85rem;">No scripts found.</div>`;
    } else {
      filteredList.forEach(item => {
        const isSelected = (item.path && this.selectedFilePath === item.path) || (!item.path && this.selectedFilePath === item.serviceKey);
        
        let statusClass = 'inactive';
        if (item.status === 'active') statusClass = 'active';

        const sizeStr = item.size ? `${(item.size / 1024).toFixed(1)} KB` : '';
        const mtimeStr = item.mtime ? this.formatRelativeTime(item.mtime) : '';
        const rightLabel = sizeStr ? sizeStr : 'Custom';

        listHtml += `
          <div class="script-card ${isSelected ? 'selected' : ''}" data-path="${item.path || item.serviceKey}">
            <div class="status-indicator ${statusClass}"></div>
            <div class="script-meta">
              <div class="card-header-row">
                <h4 class="card-title">${item.name}</h4>
                <span class="card-time">${mtimeStr || rightLabel}</span>
              </div>
            </div>
          </div>
        `;
      });
    }

    scriptsListEl.innerHTML = listHtml;

    // Attach middle cards click handlers
    scriptsListEl.querySelectorAll('.script-card').forEach(el => {
      el.addEventListener('click', (e) => {
        const path = e.currentTarget.getAttribute('data-path');
        this.selectFile(path);
      });
    });

    // 3. Render Right Workspace content
    this.renderRightWorkspace(pyscriptServices);
  }

  formatRelativeTime(mtimeSeconds) {
    if (!mtimeSeconds) return '';
    const diffMs = Date.now() - (mtimeSeconds * 1000);
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 30) return `${diffDays} days ago`;
    return new Date(mtimeSeconds * 1000).toLocaleDateString();
  }

  highlightPython(code) {
    // Escape HTML
    let html = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Placeholders collection
    const placeholders = [];
    
    // 1. Triple quote strings (double and single)
    html = html.replace(/(""\"[\s\S]*?""\")|(\'\'\'[\s\S]*?\'\'\')/g, (match) => {
      const placeholder = `__PLACEHOLDER_${placeholders.length}__`;
      placeholders.push({ placeholder, html: `<span class="hl-string">${match}</span>` });
      return placeholder;
    });

    // 2. Single line strings (double and single)
    html = html.replace(/("[^"\n]*")|('[^'\n]*')/g, (match) => {
      const placeholder = `__PLACEHOLDER_${placeholders.length}__`;
      placeholders.push({ placeholder, html: `<span class="hl-string">${match}</span>` });
      return placeholder;
    });

    // 3. Comments
    html = html.replace(/(#[^\n]*)/g, (match) => {
      const placeholder = `__PLACEHOLDER_${placeholders.length}__`;
      placeholders.push({ placeholder, html: `<span class="hl-comment">${match}</span>` });
      return placeholder;
    });

    // Highlight decorators
    html = html.replace(/(@\w+)/g, '<span class="hl-decorator">$1</span>');

    // Highlight keywords
    const keywords = /\b(def|class|return|if|else|elif|for|while|in|import|from|as|try|except|raise|and|or|not|is|lambda|pass|break|continue|global|nonlocal|assert|with|yield)\b/g;
    html = html.replace(keywords, '<span class="hl-keyword">$1</span>');

    // Highlight builtins
    const builtins = /\b(self|True|False|None|log|print)\b/g;
    html = html.replace(builtins, '<span class="hl-builtin">$1</span>');

    // Highlight functions
    html = html.replace(/\b(\w+)(?=\s*\()/g, '<span class="hl-function">$1</span>');

    // Highlight numbers
    html = html.replace(/\b(\d+)\b/g, '<span class="hl-number">$1</span>');

    // Restore placeholders
    for (let i = placeholders.length - 1; i >= 0; i--) {
      html = html.replace(placeholders[i].placeholder, placeholders[i].html);
    }

    return html;
  }

  updateHighlighting() {
    const codeEl = this.shadowRoot.getElementById('highlight-code');
    if (codeEl) {
      codeEl.innerHTML = this.highlightPython(this.selectedFileContent);
    }
  }

  renderRightWorkspace(pyscriptServices) {
    const container = this.shadowRoot.getElementById('right-workspace');
    if (!container) return;

    if (!this.selectedFilePath) {
      // Render Empty state matching the Dynatrace visual style
      container.innerHTML = `
        <div class="empty-workspace-state">
          <div class="empty-icon-box">
            <svg style="width:80px; height:80px;" viewBox="0 0 24 24">
              <path fill="currentColor" d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20M11,17H13V19H11V17M11,11H13V15H11V11" />
            </svg>
          </div>
          <div class="empty-heading">Select an item to edit</div>
          <p class="empty-text">Choose a Python script from the list, or click the create button in the list header to add a new script.</p>
        </div>
      `;
      return;
    }

    // Identify active selected item
    const file = this.files.find(f => f.path === this.selectedFilePath);
    const serviceKey = file ? this.getServiceKey(file.path) : this.selectedFilePath;
    const serviceData = pyscriptServices[serviceKey];

    const titleName = file ? file.name : serviceKey;
    const relativePath = file ? `pyscript/${file.path}` : `virtual.service/${serviceKey}`;

    // Generate workspace header and outline
    let bodyHtml = '';

    if (this.activeTab === 'visual') {
      // Visual Execution Tab
      let paramsFormHtml = '';
      const fields = serviceData?.fields;

      if (fields && Object.keys(fields).length > 0) {
        paramsFormHtml = Object.keys(fields).map(fieldKey => {
          const field = fields[fieldKey];
          
          let inputControl = '';
          const uniqueId = `field-${serviceKey}-${fieldKey}`;

          // Form input element generation
          if (field.selector && field.selector.number) {
            const num = field.selector.number;
            const min = num.min ?? 0;
            const max = num.max ?? 100;
            const step = num.step ?? 1;
            const mode = num.mode ?? 'slider';

            if (mode === 'slider') {
              inputControl = `
                <div class="range-slider-wrapper">
                  <input type="range" class="range-slider" id="${uniqueId}" min="${min}" max="${max}" step="${step}" value="${min}" data-field="${fieldKey}" data-script="${serviceKey}">
                  <span class="slider-val" id="val-${serviceKey}-${fieldKey}">${min}</span>
                </div>
              `;
            } else {
              inputControl = `<input type="number" class="form-input-text" id="${uniqueId}" min="${min}" max="${max}" step="${step}" value="${min}">`;
            }
          } else if (field.selector && field.selector.boolean) {
            inputControl = `
              <div class="checkbox-wrapper">
                <input type="checkbox" class="checkbox-input" id="${uniqueId}">
                <label class="form-label" style="font-weight:normal;" for="${uniqueId}">Enable parameter</label>
              </div>
            `;
          } else {
            // Text fallback
            const defVal = field.default ?? '';
            inputControl = `<input type="text" class="form-input-text" id="${uniqueId}" value="${defVal}" placeholder="Enter value...">`;
          }

          return `
            <div class="form-row">
              <div class="form-label">${field.name || fieldKey} <span style="font-family:monospace; font-size:0.75rem; color:var(--text-muted); font-weight:normal;">(${fieldKey})</span></div>
              ${inputControl}
            </div>
          `;
        }).join('');
      } else {
        paramsFormHtml = `
          <div style="color:var(--text-muted); font-size:0.82rem; padding:12px 0;">
            This script does not require any execution parameters.
          </div>
        `;
      }

      bodyHtml = `
        <div class="visual-cockpit">
          <!-- Parameter Configuration Card -->
          <div class="card-panel">
            <div class="panel-heading">Service Fields / Arguments</div>
            ${paramsFormHtml}
            
            <div style="margin-top:24px;">
              <button class="btn-action-primary" id="btn-run-script">
                <svg style="width:18px;height:18px;" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M8,5.14V19.14L19,12.14L8,5.14Z"/>
                </svg>
                Run Pyscript Service
              </button>
            </div>
          </div>

          <!-- Console Terminal Card -->
          <div class="console-container">
            <div class="console-header">
              <span>Console Logs</span>
              <span style="cursor:pointer;" id="btn-clear-console">Clear</span>
            </div>
            <div class="console-body" id="console-output">
              <!-- Render console logs -->
            </div>
          </div>
        </div>
      `;
    } else {
      // Code Editor Tab
      const isVirtual = !file;
      const editorStatusText = isVirtual ? 'Virtual script. Editing disabled.' : `${relativePath}`;
      bodyHtml = `
        <div class="editor-workspace">
          <div class="code-editor-container">
            <div class="line-numbers" id="line-numbers">
              <!-- Line numbers dynamic -->
            </div>
            <div class="code-editor-wrapper">
              <pre class="highlight-overlay" id="highlight-overlay"><code class="python-code" id="highlight-code"></code></pre>
              <textarea class="code-textarea" id="code-textarea" spellcheck="false" ${isVirtual ? 'readonly' : ''}></textarea>
            </div>
          </div>
          <div class="editor-actions-bar">
            <span class="editor-status">${editorStatusText}</span>
            <div class="editor-buttons">
              <button class="btn-action-secondary" id="btn-reload-pyscripts">
                <svg style="width:16px;height:16px;vertical-align:middle;margin-right:4px;" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M12,18A6,6 0 1,1 18,12A6,6 0 0,1 12,18M12,2A10,10 0 1,0 22,12A10,10 0 0,0 12,2Z"/>
                </svg>
                Reload Engine
              </button>
              <button class="btn-action-primary" id="btn-save" ${isVirtual ? 'disabled' : ''}>
                <svg style="width:16px;height:16px;" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M15,9H5V5H15M12,19A3,3 0 0,1 9,16A3,3 0 0,1 12,13A3,3 0 0,1 15,16A3,3 0 0,1 12,19M17,3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V7L17,3Z"/>
                </svg>
                Save Script
              </button>
            </div>
          </div>
        </div>
      `;
    }

    // Render Right Panel Scaffold
    container.innerHTML = `
      <!-- Workspace Header (matching visual tabs of the screenshot) -->
      <div class="workspace-header">
        <div class="workspace-title-info">
          <h2 class="workspace-title">${titleName}</h2>
          <span class="workspace-subtitle">${relativePath}</span>
        </div>
        <div class="workspace-controls">
          <div class="toggle-group">
            <button class="toggle-btn ${this.activeTab === 'visual' ? 'active' : ''}" id="tab-visual-btn">Visual</button>
            <button class="toggle-btn ${this.activeTab === 'code' ? 'active' : ''}" id="tab-code-btn">Code Editor</button>
          </div>
        </div>
      </div>

      <!-- Main Workspace Scroll Area -->
      <div class="workspace-scrollable">
        ${bodyHtml}
      </div>
    `;

    // Connect event listeners
    this.shadowRoot.getElementById('tab-visual-btn').addEventListener('click', () => {
      this.activeTab = 'visual';
      this.updatePanel();
    });

    this.shadowRoot.getElementById('tab-code-btn').addEventListener('click', () => {
      this.activeTab = 'code';
      this.updatePanel();
    });

    // Run Code Editor Setup synchronously if active
    if (this.activeTab === 'code') {
      const textarea = this.shadowRoot.getElementById('code-textarea');
      const highlightOverlay = this.shadowRoot.getElementById('highlight-overlay');
      if (textarea) {
        textarea.value = this.selectedFileContent;
        this.updateLineNumbers();
        this.updateHighlighting();
        
        // Attach code editor scroll syncing
        const lineNumbers = this.shadowRoot.getElementById('line-numbers');
        textarea.addEventListener('scroll', () => {
          lineNumbers.scrollTop = textarea.scrollTop;
          if (highlightOverlay) {
            highlightOverlay.scrollTop = textarea.scrollTop;
            highlightOverlay.scrollLeft = textarea.scrollLeft;
          }
        });
        
        textarea.addEventListener('input', () => {
          this.isEditing = true;
          this.selectedFileContent = textarea.value;
          this.updateLineNumbers();
          this.updateHighlighting();
        });

        // Tab key support
        textarea.addEventListener('keydown', (e) => {
          if (e.key === 'Tab') {
            e.preventDefault();
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const val = textarea.value;

            // Insert 4 spaces
            textarea.value = val.substring(0, start) + '    ' + val.substring(end);

            // Put caret at right position
            textarea.selectionStart = textarea.selectionEnd = start + 4;

            // Trigger updates
            this.isEditing = true;
            this.selectedFileContent = textarea.value;
            this.updateLineNumbers();
            this.updateHighlighting();
          }
        });
      }
    }

    if (this.activeTab === 'visual') {
      this.renderConsole();

      const runBtn = this.shadowRoot.getElementById('btn-run-script');
      if (runBtn) {
        runBtn.addEventListener('click', () => {
          this.runScript(serviceKey, serviceData?.fields);
        });
      }

      const clearConsoleBtn = this.shadowRoot.getElementById('btn-clear-console');
      if (clearConsoleBtn) {
        clearConsoleBtn.addEventListener('click', () => {
          this.consoleLogs = [];
          this.renderConsole();
        });
      }

      // Slider values sync
      if (serviceData?.fields) {
        Object.keys(serviceData.fields).forEach(fieldKey => {
          const slider = this.shadowRoot.getElementById(`field-${serviceKey}-${fieldKey}`);
          if (slider && slider.type === 'range') {
            slider.addEventListener('input', (e) => {
              const span = this.shadowRoot.getElementById(`val-${serviceKey}-${fieldKey}`);
              if (span) span.textContent = e.target.value;
            });
          }
        });
      }
    } else {
      // Code Editor Tab buttons
      const saveBtn = this.shadowRoot.getElementById('btn-save');
      if (saveBtn) {
        saveBtn.addEventListener('click', () => {
          this.saveFile();
        });
      }

      const reloadBtn = this.shadowRoot.getElementById('btn-reload-pyscripts');
      if (reloadBtn) {
        reloadBtn.addEventListener('click', () => {
          this.reloadPyscripts();
        });
      }
    }
  }

  updateLineNumbers() {
    const textarea = this.shadowRoot.getElementById('code-textarea');
    const lineNumbers = this.shadowRoot.getElementById('line-numbers');
    if (!textarea || !lineNumbers) return;

    const lines = textarea.value.split('\n').length;
    let numbers = '';
    for (let i = 1; i <= lines; i++) {
      numbers += `<div>${i}</div>`;
    }
    lineNumbers.innerHTML = numbers;
  }
}

customElements.define('pyscrypt-manager-panel', PyscryptManagerPanel);
