const MAX_LOGS = 500;
const logBuffer: string[] = [];
let overlayEl: HTMLDivElement | null = null;
let visible = false;
let initialized = false;

export function debugLog(...args: any[]): void {
    const msg = args.map(a =>
        typeof a === 'object' && a !== null
            ? (a.constructor?.name === 'Object' ? JSON.stringify(a) : String(a))
            : String(a)
    ).join(' ');
    logBuffer.push(msg);
    if (logBuffer.length > MAX_LOGS) logBuffer.shift();
    console.log(...args);
    if (visible && overlayEl) {
        updateOverlay();
    }
}

/** Initialize the floating toggle button on screen */
function ensureUI(): void {
    if (initialized) return;
    initialized = true;

    // Full-screen overlay
    overlayEl = document.createElement('div');
    overlayEl.id = 'debug-overlay';
    overlayEl.style.cssText = [
        'position: fixed',
        'top: 0',
        'left: 0',
        'width: 100%',
        'height: 100%',
        'background: rgba(0,0,0,0.88)',
        'color: #0f0',
        'font-family: monospace',
        'font-size: 10px',
        'overflow-y: auto',
        'z-index: 99999',
        'padding: 40px 8px 8px 8px',
        'pointer-events: auto',
        'white-space: pre-wrap',
        'display: none'
    ].join(';');
    document.body.appendChild(overlayEl);

    // Close button inside overlay
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕ Close';
    closeBtn.style.cssText = [
        'position: fixed',
        'top: 8px',
        'right: 8px',
        'z-index: 100000',
        'background: rgba(255,0,0,0.6)',
        'color: #fff',
        'border: none',
        'padding: 6px 12px',
        'border-radius: 4px',
        'cursor: pointer',
        'font-size: 14px',
        'font-family: monospace'
    ].join(';');
    closeBtn.addEventListener('click', () => toggleDebugOverlay());
    overlayEl.appendChild(closeBtn);

    // Export button inside overlay
    const exportBtn = document.createElement('button');
    exportBtn.textContent = '📋 Copy Logs';
    exportBtn.style.cssText = [
        'position: fixed',
        'top: 8px',
        'left: 8px',
        'z-index: 100000',
        'background: rgba(0,100,200,0.8)',
        'color: #fff',
        'border: none',
        'padding: 6px 12px',
        'border-radius: 4px',
        'cursor: pointer',
        'font-size: 14px',
        'font-family: monospace'
    ].join(';');
    exportBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const text = logBuffer.join('\n');
        // Use a temporary textarea for reliable mobile copy
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;pointer-events:none;';
        document.body.appendChild(ta);
        ta.select();
        try {
            document.execCommand('copy');
            exportBtn.textContent = '✅ Copied!';
            exportBtn.style.background = 'rgba(0,150,0,0.8)';
        } catch {
            // If execCommand also fails, select the overlay text as fallback
            const range = document.createRange();
            range.selectNodeContents(overlayEl!);
            const sel = window.getSelection();
            if (sel) { sel.removeAllRanges(); sel.addRange(range); }
            exportBtn.textContent = '⚠️ Select text & copy';
            exportBtn.style.background = 'rgba(200,150,0,0.8)';
        }
        document.body.removeChild(ta);
        setTimeout(() => {
            exportBtn.textContent = '📋 Copy Logs';
            exportBtn.style.background = 'rgba(0,100,200,0.8)';
        }, 3000);
    });
    overlayEl.appendChild(exportBtn);

    // Log content area
    const contentArea = document.createElement('div');
    contentArea.id = 'debug-log-content';
    overlayEl.appendChild(contentArea);
}

export function toggleDebugOverlay(): void {
    ensureUI();
    visible = !visible;
    if (!overlayEl) return;
    overlayEl.style.display = visible ? 'block' : 'none';
    if (visible) updateOverlay();
}

function updateOverlay(): void {
    if (!overlayEl) return;
    const content = overlayEl.querySelector('#debug-log-content');
    if (content) {
        content.textContent = logBuffer.join('\n');
    }
    overlayEl.scrollTop = overlayEl.scrollHeight;
}

export function getDebugLogs(): string[] {
    return logBuffer.slice();
}
