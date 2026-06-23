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
      // Seed the cache before loadFiles so the first service-change event
      // doesn't trigger a redundant second updatePanel() call.
      this._cachedServices = JSON.stringify(hass.services?.pyscrypt || {});
      this.loadFiles();
    } else {
      // Only re-render when pyscript services actually change — HA fires this
      // setter on every state update, which would otherwise constantly recreate
      // the editor DOM and break focus/cursor while the user is typing.
      const services = JSON.stringify(hass.services?.pyscript || {});
      if (services !== this._cachedServices) {
        this._cachedServices = services;
        this.updatePanel();
      }
    }
  }

  constructor() {
    super();
    this.files = [];
    this.selectedFilePath = null;
    this.selectedFileContent = '';
    this.selectedFileOriginalContent = '';
    this.isEditing = false;
    // True when the current file's content failed to load. The editor is then
    // mounted read-only and Save is disabled so the error placeholder can never
    // be written over the real script on disk.
    this.selectedFileLoadError = false;
    this.activeTab = 'visual'; // 'visual' or 'code'

    // Filters
    this.selectedFolder = ''; // folder string
    this.searchQuery = '';
    this.expandedFolders = {}; // path string -> boolean (true = expanded)

    // Console output log
    this.consoleLogs = [];

    // Cache to avoid re-rendering on every HA state update
    this._cachedServices = null;

    // CodeMirror editor instance and cached modules
    this._cmEditor = null;
    this._cmModules = null;
    // Generation counter: incremented each time the workspace is rebuilt.
    // _initCodeEditor captures the generation before its async CDN fetch and
    // bails out if it has changed by the time the editor would be created,
    // preventing two concurrent inits from both mounting an editor.
    this._cmGeneration = 0;
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
        const clean = this.sanitizeContent(result.content);
        this.selectedFileContent = clean;
        this.selectedFileOriginalContent = clean;
        this.selectedFileLoadError = false;
      } catch (err) {
        console.error('Failed to load file content:', err);
        this.selectedFileContent = `# Error loading file: ${err.message || err}`;
        this.selectedFileOriginalContent = this.selectedFileContent;
        this.selectedFileLoadError = true;
      }
    } else {
      this.selectedFileContent = '';
      this.selectedFileOriginalContent = '';
      this.selectedFileLoadError = false;
    }

    this.updatePanel();
  }

  async saveFile() {
    if (!this.selectedFilePath) return;
    // Never persist the "# Error loading file" placeholder over the real script.
    if (this.selectedFileLoadError) return;

    // selectedFileContent is kept current by the CM update listener

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
    if (path.includes('..')) {
      alert('Invalid path: Directory traversal is not allowed.');
      return;
    }
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

  escapeHtml(text) {
    if (typeof text !== 'string') text = String(text);
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
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
        <span style="color:var(--text-main); white-space:pre-wrap;">${this.escapeHtml(log.message)}</span>
      </div>`;
    }).join('');

    container.scrollTop = container.scrollHeight;
  }

  async runScript(serviceKey, fields) {
    // Pyscript registers services under the @service-decorated function name,
    // not the filename. If no matching service is registered, fail early with
    // an actionable message instead of a raw "service not found" error.
    const registered = (this._hass && this._hass.services.pyscript) || {};
    if (!registered[serviceKey]) {
      this.logToConsole(
        'Service Result',
        `No registered service pyscript.${serviceKey}. Pyscript names services ` +
        `after the @service-decorated function, not the filename — confirm the ` +
        `file defines "@service\\ndef ${serviceKey}(...)", then click Reload Engine.`,
        'error'
      );
      return;
    }

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

        .cm-editor-mount {
          flex-grow: 1;
          overflow: hidden;
          border: 1px solid var(--border-color);
          border-radius: 8px;
          min-height: 0;
        }

        .cm-editor-mount .cm-editor {
          height: 100%;
          border-radius: 8px;
        }

        .cm-editor-mount .cm-scroller {
          overflow: auto;
        }

        .cm-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          height: 100%;
          background-color: var(--editor-bg);
          color: var(--text-muted);
          font-size: 0.85rem;
        }

        .cm-spinner {
          width: 32px;
          height: 32px;
          border: 3px solid var(--border-color);
          border-top-color: var(--primary-color);
          border-radius: 50%;
          animation: cm-spin 0.7s linear infinite;
        }

        @keyframes cm-spin {
          to { transform: rotate(360deg); }
        }

        .cm-load-error {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          height: 100%;
          padding: 24px;
          text-align: center;
          background-color: var(--editor-bg);
        }

        .cm-load-error-title {
          font-weight: 600;
          margin: 0;
        }

        .cm-load-error-detail {
          margin: 0;
          opacity: 0.7;
          font-size: 0.85rem;
          max-width: 360px;
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

    const el = this.shadowRoot.querySelector(`[data-folder-path="${this.selectedFolder}"]`);
    if (el) el.classList.add('active');
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

          // Set selected folder path
          this.selectedFolder = folderPath;
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

      displayList.push({
        type: 'file',
        path: file.path,
        name: file.name,
        serviceKey: serviceKey,
        mtime: file.mtime,
        size: file.size,
        // active only when a pyscript service with this name is actually registered
        status: pyscriptServices[serviceKey] ? 'active' : 'inactive'
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

  sanitizeContent(content) {
    // Strip <span class="hl-*"> tags injected by the legacy custom highlighter
    // if any were accidentally persisted to disk. Only runs when the signature
    // pattern is present so clean files are returned unchanged.
    if (!content.includes('<span class="hl-')) return content;
    let clean = content.replace(/<span class="hl-[^"]*">([\s\S]*?)<\/span>/g, '$1');
    clean = clean
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'");
    return clean;
  }

  async loadCodeMirror() {
    if (this._cmModules) return this._cmModules;
    // Pin exact versions. The `codemirror@6` range resolves to the anomalous
    // 6.65.7 publish, a CM5-style bundle that only has a `default` export, so
    // named imports like { EditorView, basicSetup } come back undefined.
    const [{ EditorView, basicSetup }, { python }, { oneDark }] = await Promise.all([
      import('https://esm.sh/codemirror@6.0.2'),
      import('https://esm.sh/@codemirror/lang-python@6.2.1'),
      import('https://esm.sh/@codemirror/theme-one-dark@6.1.3'),
    ]);
    this._cmModules = { EditorView, basicSetup, python, oneDark };
    return this._cmModules;
  }

  async _initCodeEditor(readonly = false) {
    // Capture the generation at call-time. If renderRightWorkspace rebuilds the
    // DOM before the CDN fetch completes, the generation will have incremented
    // and this stale init will bail out instead of mounting a duplicate editor.
    const generation = this._cmGeneration;

    const mount = this.shadowRoot.getElementById('cm-editor-mount');
    if (!mount) return;

    let modules;
    try {
      modules = await this.loadCodeMirror();
    } catch (err) {
      // CDN unreachable, esm.sh outage, or a bad package publish. Surface a
      // visible, retryable error instead of leaving the tab permanently blank.
      console.error('Failed to load CodeMirror from CDN:', err);
      if (this._cmGeneration !== generation) return;
      const liveMount = this.shadowRoot.getElementById('cm-editor-mount');
      if (liveMount) this._renderEditorLoadError(liveMount, readonly);
      return;
    }
    const { EditorView, basicSetup, python, oneDark } = modules;

    // Bail if a newer init has started or the mount was removed
    if (this._cmGeneration !== generation) return;
    if (!this.shadowRoot.getElementById('cm-editor-mount')) return;

    const isDark = this.getAttribute('theme') !== 'light';

    const extensions = [
      basicSetup,
      python(),
      EditorView.updateListener.of(update => {
        if (update.docChanged) {
          this.selectedFileContent = update.state.doc.toString();
          this.isEditing = true;
        }
      }),
      EditorView.theme({
        '&': { height: '100%', backgroundColor: 'var(--editor-bg)' },
        '.cm-scroller': {
          fontFamily: "'Fira Code', 'Courier New', monospace",
          fontSize: '0.85rem',
          lineHeight: '1.5',
        },
        '.cm-gutters': { backgroundColor: 'var(--editor-lines-bg)', borderRight: '1px solid var(--border-color)' },
        '.cm-lineNumbers .cm-gutterElement': { color: 'var(--editor-lines-text)' },
      }),
    ];

    if (isDark) extensions.push(oneDark);
    if (readonly) extensions.push(EditorView.editable.of(false));

    // Remove the loading spinner before mounting the editor.
    mount.innerHTML = '';

    this._cmEditor = new EditorView({
      doc: this.selectedFileContent,
      extensions,
      parent: mount,
      root: this.shadowRoot,
    });
  }

  _editorLoadingHtml() {
    return `
      <div class="cm-loading">
        <div class="cm-spinner"></div>
        <span>Loading source code…</span>
      </div>
    `;
  }

  _renderEditorLoadError(mount, readonly) {
    mount.innerHTML = `
      <div class="cm-load-error">
        <p class="cm-load-error-title">Couldn't load the code editor.</p>
        <p class="cm-load-error-detail">The editor library is fetched from a CDN. Check your network connection and try again.</p>
        <button class="btn-action-secondary" id="btn-retry-cm">Retry</button>
      </div>
    `;
    const retryBtn = mount.querySelector('#btn-retry-cm');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        mount.innerHTML = this._editorLoadingHtml();
        this._initCodeEditor(readonly).catch(err => {
          console.error('Code editor initialization failed:', err);
          if (mount.isConnected) this._renderEditorLoadError(mount, readonly);
        });
      });
    }
  }

  renderRightWorkspace(pyscriptServices) {
    const container = this.shadowRoot.getElementById('right-workspace');
    if (!container) return;

    // Destroy any existing CM editor and invalidate any in-flight async init
    if (this._cmEditor) {
      this._cmEditor.destroy();
      this._cmEditor = null;
    }
    this._cmGeneration++;

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
    const isVirtual = !file;
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

      const serviceRegistered = !!serviceData;
      const notRegisteredBanner = serviceRegistered ? '' : `
            <div style="margin-bottom:16px; padding:10px 14px; border-radius:8px; background:rgba(220,38,38,0.12); border:1px solid var(--error-color); color:var(--text-main); font-size:0.82rem; line-height:1.45;">
              No registered service <code>pyscript.${serviceKey}</code>. Pyscript names services after the <code>@service</code>-decorated function, not the filename. Confirm the file defines <code>@service\ndef ${serviceKey}(...)</code>, then click <strong>Reload Engine</strong>.
            </div>`;

      bodyHtml = `
        <div class="visual-cockpit">
          <!-- Parameter Configuration Card -->
          <div class="card-panel">
            <div class="panel-heading">Service Fields / Arguments</div>
            ${notRegisteredBanner}
            ${paramsFormHtml}

            <div style="margin-top:24px;">
              <button class="btn-action-primary" id="btn-run-script" ${serviceRegistered ? '' : 'disabled'}>
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
      // Code Editor Tab — CodeMirror mounts into #cm-editor-mount after innerHTML is set
      const editorReadonly = isVirtual || this.selectedFileLoadError;
      const editorStatusText = this.selectedFileLoadError
        ? 'Failed to load file. Editing disabled to protect the script on disk.'
        : (isVirtual ? 'Virtual script. Editing disabled.' : `${relativePath}`);
      bodyHtml = `
        <div class="editor-workspace">
          <div id="cm-editor-mount" class="cm-editor-mount">${this._editorLoadingHtml()}</div>
          <div class="editor-actions-bar">
            <span class="editor-status">${editorStatusText}</span>
            <div class="editor-buttons">
              <button class="btn-action-secondary" id="btn-reload-pyscripts">
                <svg style="width:16px;height:16px;vertical-align:middle;margin-right:4px;" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M12,18A6,6 0 1,1 18,12A6,6 0 0,1 12,18M12,2A10,10 0 1,0 22,12A10,10 0 0,0 12,2Z"/>
                </svg>
                Reload Engine
              </button>
              <button class="btn-action-primary" id="btn-save" ${editorReadonly ? 'disabled' : ''}>
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
            <button class="toggle-btn ${this.activeTab === 'visual' ? 'active' : ''}" id="tab-visual-btn">Testing</button>
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

    // Initialize CodeMirror for the code editor tab (async, non-blocking).
    // Read-only for virtual scripts or when the file failed to load. The
    // .catch() is a safety net so a CDN/init failure can never surface as an
    // unhandled promise rejection that leaves the tab silently blank.
    if (this.activeTab === 'code') {
      this._initCodeEditor(isVirtual || this.selectedFileLoadError).catch(err => {
        console.error('Code editor initialization failed:', err);
        const mount = this.shadowRoot.getElementById('cm-editor-mount');
        if (mount) this._renderEditorLoadError(mount, isVirtual || this.selectedFileLoadError);
      });
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
    } else if (this.activeTab === 'code') {
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

}


customElements.define('pyscrypt-manager-panel', PyscryptManagerPanel);
