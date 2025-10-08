// ===============================
// UI HELPERS - Shared Button Utilities
// ===============================

const UIHelpers = {
    // Common button styles
    buttonStyles: {
        base: `
            position: fixed;
            z-index: 10000;
            color: white;
            border: none;
            padding: 12px 20px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
        `,
        green: {
            background: '#10a37f',
            hoverBackground: '#0d8f6b',
            boxShadow: '0 4px 12px rgba(16,163,127,0.3)',
            hoverBoxShadow: '0 6px 16px rgba(16,163,127,0.4)'
        },
        blue: {
            background: '#0ea5e9',
            hoverBackground: '#0284c7',
            boxShadow: '0 4px 12px rgba(14,165,233,0.3)',
            hoverBoxShadow: '0 6px 16px rgba(14,165,233,0.4)'
        },
        purple: {
            background: '#8b5cf6',
            hoverBackground: '#7c3aed',
            boxShadow: '0 4px 12px rgba(139,92,246,0.3)',
            hoverBoxShadow: '0 6px 16px rgba(139,92,246,0.4)'
        }
    },

    /**
     * Create a styled button with consistent behavior
     * @param {Object} options - Button configuration
     * @param {string} options.text - Button text/HTML
     * @param {function} options.onClick - Click handler
     * @param {string} options.position - Position object {bottom, right, top, left}
     * @param {string} options.color - Color theme: 'green', 'blue', 'purple'
     * @param {string} options.id - Optional button ID
     * @param {number} options.zIndex - Optional z-index override
     * @returns {HTMLButtonElement} The created button
     */
    createButton({
        text,
        onClick,
        position = { bottom: '20px', right: '20px' },
        color = 'green',
        id = null,
        zIndex = 10000
    }) {
        const button = document.createElement('button');
        if (id) button.id = id;

        const theme = this.buttonStyles[color] || this.buttonStyles.green;

        // Build position CSS
        const positionCss = Object.entries(position)
            .map(([key, value]) => `${key}: ${value};`)
            .join('\n');

        button.style.cssText = `
            ${this.buttonStyles.base}
            ${positionCss}
            z-index: ${zIndex};
            background: ${theme.background};
            box-shadow: ${theme.boxShadow};
        `;

        button.innerHTML = text;

        // Hover effects
        button.onmouseover = () => {
            button.style.background = theme.hoverBackground;
            button.style.transform = 'translateY(-2px)';
            button.style.boxShadow = theme.hoverBoxShadow;
        };

        button.onmouseout = () => {
            button.style.background = theme.background;
            button.style.transform = 'translateY(0)';
            button.style.boxShadow = theme.boxShadow;
        };

        button.onclick = onClick;

        return button;
    },

    /**
     * Create update script button (visible on hover)
     * @param {HTMLElement} container - Parent container to attach hover listener
     * @returns {HTMLButtonElement} The update button
     */
    createUpdateScriptButton(container) {
        // Get current version (injected during build)
        const version = typeof SCRIPT_VERSION !== 'undefined' ? SCRIPT_VERSION : 'unknown';

        const updateButton = this.createButton({
            text: `🔄 更新脚本 (v${version})`,
            onClick: () => {
                window.open('https://raw.githubusercontent.com/chyx/chat-syncer/refs/heads/main/chat-syncer-unified.user.js', '_blank');
            },
            position: {},
            color: 'blue',
            id: 'update-script-button'
        });

        // Override position to relative for container usage
        updateButton.style.position = 'relative';

        // Initially hidden
        updateButton.style.opacity = '0';
        updateButton.style.visibility = 'hidden';
        updateButton.style.maxHeight = '0';
        updateButton.style.overflow = 'hidden';
        updateButton.style.marginTop = '0';

        // Show on container hover
        if (container) {
            let hoverTimer;

            container.addEventListener('mouseenter', () => {
                hoverTimer = setTimeout(() => {
                    updateButton.style.opacity = '1';
                    updateButton.style.visibility = 'visible';
                    updateButton.style.maxHeight = '100px';
                    updateButton.style.marginTop = '12px';
                }, 300); // 300ms delay
            });

            container.addEventListener('mouseleave', () => {
                clearTimeout(hoverTimer);
                updateButton.style.opacity = '0';
                updateButton.style.visibility = 'hidden';
                updateButton.style.maxHeight = '0';
                updateButton.style.marginTop = '0';
            });
        }

        return updateButton;
    },

    /**
     * Create a button container that can hold multiple buttons
     * @param {Object} position - Position object {bottom, right, top, left}
     * @returns {HTMLDivElement} The container element
     */
    createButtonContainer(position = { bottom: '20px', right: '20px' }) {
        const container = document.createElement('div');
        container.style.cssText = `
            position: fixed;
            ${Object.entries(position).map(([key, value]) => `${key}: ${value};`).join('\n')}
            z-index: 10000;
            display: flex;
            flex-direction: column-reverse;
            gap: 12px;
            cursor: move;
        `;

        // Add drag handle
        const dragHandle = document.createElement('div');
        dragHandle.textContent = '⋮⋮';
        dragHandle.style.cssText = `
            position: absolute;
            bottom: -8px;
            left: -8px;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background: #6b7280;
            color: white;
            border: 2px solid white;
            font-size: 12px;
            font-weight: bold;
            cursor: move;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0;
            line-height: 1;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            z-index: 10;
            opacity: 0;
            visibility: hidden;
            transition: opacity 0.2s, visibility 0.2s;
        `;

        // Add close button
        const closeButton = document.createElement('button');
        closeButton.textContent = '×';
        closeButton.style.cssText = `
            position: absolute;
            top: -8px;
            right: -8px;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background: #ff4444;
            color: white;
            border: 2px solid white;
            font-size: 18px;
            font-weight: bold;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0;
            line-height: 1;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            z-index: 10;
            opacity: 0;
            visibility: hidden;
            transition: opacity 0.2s, visibility 0.2s;
        `;
        closeButton.onclick = () => {
            container.remove();
        };

        // Show drag handle and close button on hover
        let hoverTimeout;
        container.addEventListener('mouseenter', () => {
            hoverTimeout = setTimeout(() => {
                dragHandle.style.opacity = '1';
                dragHandle.style.visibility = 'visible';
                closeButton.style.opacity = '1';
                closeButton.style.visibility = 'visible';
            }, 300);
        });

        container.addEventListener('mouseleave', () => {
            clearTimeout(hoverTimeout);
            dragHandle.style.opacity = '0';
            dragHandle.style.visibility = 'hidden';
            closeButton.style.opacity = '0';
            closeButton.style.visibility = 'hidden';
        });

        // Make container draggable
        let isDragging = false;
        let currentX;
        let currentY;
        let initialX;
        let initialY;

        const dragStart = (e) => {
            // Get initial mouse position
            if (e.type === 'touchstart') {
                initialX = e.touches[0].clientX;
                initialY = e.touches[0].clientY;
            } else {
                initialX = e.clientX;
                initialY = e.clientY;
            }

            // Get current container position
            const rect = container.getBoundingClientRect();
            currentX = rect.left;
            currentY = rect.top;

            isDragging = true;
            container.style.transition = 'none';
        };

        const drag = (e) => {
            if (!isDragging) return;

            e.preventDefault();

            let clientX, clientY;
            if (e.type === 'touchmove') {
                clientX = e.touches[0].clientX;
                clientY = e.touches[0].clientY;
            } else {
                clientX = e.clientX;
                clientY = e.clientY;
            }

            const deltaX = clientX - initialX;
            const deltaY = clientY - initialY;

            const newX = currentX + deltaX;
            const newY = currentY + deltaY;

            // Remove bottom/right positioning and use top/left instead
            container.style.bottom = 'auto';
            container.style.right = 'auto';
            container.style.left = `${newX}px`;
            container.style.top = `${newY}px`;
        };

        const dragEnd = () => {
            isDragging = false;
            container.style.transition = '';
        };

        // Mouse events
        container.addEventListener('mousedown', dragStart);
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', dragEnd);

        // Touch events for mobile
        container.addEventListener('touchstart', dragStart);
        document.addEventListener('touchmove', drag);
        document.addEventListener('touchend', dragEnd);

        container.appendChild(dragHandle);
        container.appendChild(closeButton);

        return container;
    }
};
