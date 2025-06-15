let selectedElement = null;
let isDragging = false;
let isResizing = false;
let dragOffset = { x: 0, y: 0 };
let draggedElement = null; // Track which element is being dragged
let formElements = [];
let elementIdCounter = 0;
let gridVisible = true;
let formName = 'Neues Formular';
let defaultFontFamily = 'Arial';
let defaultFontSize = 10; // Reduced default font size for better PDF proportions
let undoStack = [];
let redoStack = [];
const maxUndoSteps = 50;
let currentPage = 1;
let totalPages = 1;
let pages = [{ id: 1, elements: [], header: '', footer: '' }];

const page = document.getElementById('pageContent');
const propertiesPanel = document.getElementById('propertyContent');
const horizontalLine = document.getElementById('horizontalLine');
const verticalLine = document.getElementById('verticalLine');
const elementOrderList = document.getElementById('elementOrderList');

// Toolbar buttons
document.getElementById('addTextField').addEventListener('click', () => addFormElement('text'));
document.getElementById('addDropdown').addEventListener('click', () => addFormElement('dropdown'));
document.getElementById('addRadio').addEventListener('click', () => addFormElement('radio'));
document.getElementById('addCheckbox').addEventListener('click', () => addFormElement('checkbox'));
document.getElementById('addText').addEventListener('click', () => addFormElement('staticText'));
document.getElementById('addImage').addEventListener('click', () => addFormElement('image'));
document.getElementById('addSubmit').addEventListener('click', () => addFormElement('submit'));

document.getElementById('exportPDF').addEventListener('click', exportToPDF);
document.getElementById('importPDF').addEventListener('click', () => {
    document.getElementById('pdfFileInput').click();
});
document.getElementById('imageFileInput').addEventListener('change', handleImageUpload);
document.getElementById('toggleGrid').addEventListener('click', toggleGrid);
document.getElementById('pdfFileInput').addEventListener('change', importFromPDF);
document.getElementById('aboutBtn').addEventListener('click', openAboutModal);
document.getElementById('closeModal').addEventListener('click', closeAboutModal);
document.getElementById('undoBtn').addEventListener('click', undo);
document.getElementById('redoBtn').addEventListener('click', redo);
document.getElementById('prevPage').addEventListener('click', previousPage);
document.getElementById('nextPage').addEventListener('click', nextPage);
document.getElementById('addPage').addEventListener('click', addNewPage);
document.getElementById('deletePage').addEventListener('click', deletePage);

// Keyboard event listeners
document.addEventListener('keydown', handleKeyDown);

// Initialize button states
updateUndoRedoButtons();
updatePageNavigation();

// Auto-load page properties on startup
showGeneralProperties();

// Notification System
function showNotification(title, message, type = 'info', duration = 5000, showProgress = false) {
    const container = document.getElementById('notificationContainer');
    const id = 'notification_' + Date.now();
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.id = id;
    
    const icons = {
        success: '✅',
        error: '❌', 
        warning: '⚠️',
        info: 'ℹ️'
    };
    
    notification.innerHTML = `
        <div class="notification-header">
            <div class="notification-title">
                <span>${icons[type] || icons.info}</span>
                ${title}
            </div>
            <button class="notification-close" onclick="hideNotification('${id}')">&times;</button>
        </div>
        <div class="notification-message">${message}</div>
        ${showProgress ? '<div class="notification-progress"><div class="notification-progress-bar" style="width: 0%"></div></div>' : ''}
    `;
    
    container.appendChild(notification);
    
    // Trigger animation
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    // Auto-hide if duration is set
    if (duration > 0) {
        setTimeout(() => {
            hideNotification(id);
        }, duration);
    }
    
    return id;
}

function hideNotification(id) {
    const notification = document.getElementById(id);
    if (notification) {
        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }
}

function updateNotificationProgress(id, progress) {
    const notification = document.getElementById(id);
    if (notification) {
        const progressBar = notification.querySelector('.notification-progress-bar');
        if (progressBar) {
            progressBar.style.width = Math.min(100, Math.max(0, progress)) + '%';
        }
    }
}

function addFormElement(type) {
    const element = {
        id: `element_${elementIdCounter++}`,
        type: type,
        x: 50,
        y: 50,
        width: 200,
        height: 40,
        label: getDefaultLabel(type),
        name: `field_${elementIdCounter}`,
        required: false,
        value: '',
        options: type === 'dropdown' || type === 'radio' || type === 'checkbox' ? ['Option 1', 'Option 2'] : []
    };
    
    // Find free position for new element
    const position = findFreePosition(element.width, element.height);
    element.x = position.x;
    element.y = position.y;
    
    // Save state for undo
    saveState();
    
    // Add page reference
    element.pageId = currentPage;
    
    formElements.push(element);
    
    // Add to current page
    const pageData = pages.find(p => p.id === currentPage);
    if (pageData) {
        pageData.elements.push(element);
    }
    
    createFormElementDOM(element);
    updateElementOrderList();
    
    // Show general properties when first element is added
    if (formElements.length === 1) {
        showGeneralProperties();
    }
}

function findFreePosition(width, height) {
    const pageWidth = 794; // Page width in pixels
    const pageHeight = 1123; // Page height in pixels
    const margin = 20; // Margin from edges
    const gridSize = 20; // Snap to grid
    const labelHeight = 20; // Space needed for label above element
    
    // Start position (accounting for label space and header if exists)
    const pageData = pages.find(p => p.id === currentPage);
    const headerOffset = pageData?.header ? 60 : 0; // Extra space if header exists
    
    let x = margin;
    let y = margin + labelHeight + headerOffset;
    
    // Check if position is free
    function isPositionFree(testX, testY) {
        const testRect = {
            left: testX,
            top: testY - labelHeight, // Include label space above
            right: testX + width,
            bottom: testY + height
        };
        
        // Only check elements on the current page
        const currentPageElements = formElements.filter(el => el.pageId === currentPage);
        
        return !currentPageElements.some(element => {
            const elementRect = {
                left: element.x,
                top: element.y - labelHeight, // Include label space for existing elements
                right: element.x + element.width,
                bottom: element.y + element.height
            };
            
            // Check for overlap
            return !(testRect.right <= elementRect.left || 
                    testRect.left >= elementRect.right || 
                    testRect.bottom <= elementRect.top || 
                    testRect.top >= elementRect.bottom);
        });
    }
    
    // Try to find free position
    while (y + height <= pageHeight - margin) {
        x = margin;
        
        while (x + width <= pageWidth - margin) {
            if (isPositionFree(x, y)) {
                return { x: x, y: y };
            }
            
            // Move right by grid size
            x += gridSize;
        }
        
        // Move to next row (accounting for label height)
        y += Math.max(gridSize, height + labelHeight + 10); // Add some extra spacing between rows
    }
    
    // If no free position found, place at default position
    return { x: 50, y: 70 }; // Start lower to account for label
}

function getDefaultLabel(type) {
    const labels = {
        text: 'Textfeld',
        dropdown: 'Dropdown',
        radio: 'Radio Buttons',
        checkbox: 'Checkboxen',
        staticText: 'Text',
        image: 'Bild',
        submit: 'Senden'
    };
    return labels[type] || 'Element';
}

function createFormElementDOM(element) {
    const div = document.createElement('div');
    div.className = 'form-element';
    div.id = element.id;
    div.style.left = element.x + 'px';
    div.style.top = element.y + 'px';
    div.style.width = element.width + 'px';
    div.style.height = element.height + 'px';
    
    updateFormElementContent(div, element);
    
    // Add resize handles
    ['nw', 'ne', 'sw', 'se'].forEach(pos => {
        const handle = document.createElement('div');
        handle.className = `resize-handle ${pos}`;
        handle.addEventListener('mousedown', (e) => startResize(e, pos));
        div.appendChild(handle);
    });
    
    div.addEventListener('mousedown', startDrag);
    div.addEventListener('click', () => selectElement(element));
    
    page.appendChild(div);
}

function updateFormElementContent(div, element) {
    // Remove only the content, not the resize handles
    const handles = div.querySelectorAll('.resize-handle');
    const content = div.querySelector('.element-content');
    
    // Remove existing content container if it exists
    if (content) {
        content.remove();
    }
    
    // Create new content container
    const contentDiv = document.createElement('div');
    contentDiv.className = 'element-content';
    
    switch(element.type) {
        case 'text':
            const inputFontSize = Math.min(defaultFontSize, 14); // Cap input font size at 14px
            contentDiv.innerHTML = `
                <label style="font-family: ${defaultFontFamily} !important; font-size: ${Math.min(defaultFontSize, 12)}px !important;">${element.label}</label>
                <input type="text" placeholder="${element.label}" style="font-family: ${defaultFontFamily} !important; font-size: ${inputFontSize}px !important;" disabled>
            `;
            break;
        case 'dropdown':
            const selectFontSize = Math.min(defaultFontSize, 14); // Cap select font size at 14px
            contentDiv.innerHTML = `
                <label style="font-family: ${defaultFontFamily} !important; font-size: ${Math.min(defaultFontSize, 12)}px !important;">${element.label}</label>
                <select style="font-family: ${defaultFontFamily} !important; font-size: ${selectFontSize}px !important;" disabled>
                    ${element.options.map(opt => `<option>${opt}</option>`).join('')}
                </select>
            `;
            break;
        case 'radio':
            const radioFontSize = Math.min(defaultFontSize, 12); // Cap radio font size at 12px
            contentDiv.innerHTML = `
                <label style="font-family: ${defaultFontFamily} !important; font-size: ${Math.min(defaultFontSize, 12)}px !important;">${element.label}</label>
                <div class="radio-group">
                    ${element.options.map((opt, i) => `
                        <label style="font-family: ${defaultFontFamily} !important; font-size: ${radioFontSize}px !important;"><input type="radio" name="${element.name}" disabled> ${opt}</label>
                    `).join('')}
                </div>
            `;
            break;
        case 'checkbox':
            const checkboxFontSize = Math.min(defaultFontSize, 12); // Cap checkbox font size at 12px
            contentDiv.innerHTML = `
                <label style="font-family: ${defaultFontFamily} !important; font-size: ${Math.min(defaultFontSize, 12)}px !important;">${element.label}</label>
                <div class="checkbox-group">
                    ${element.options.map((opt, i) => `
                        <label style="font-family: ${defaultFontFamily} !important; font-size: ${checkboxFontSize}px !important;"><input type="checkbox" disabled> ${opt}</label>
                    `).join('')}
                </div>
            `;
            break;
        case 'staticText':
            div.className = 'form-element text-element';
            const textContent = element.value || 'Doppelklick zum Bearbeiten';
            contentDiv.innerHTML = `<div class="wysiwyg-text" style="font-family: ${element.fontFamily || defaultFontFamily}; font-size: ${element.fontSize || defaultFontSize}px;">${textContent}</div>`;
            contentDiv.addEventListener('dblclick', () => editTextElement(element));
            break;
        case 'image':
            div.className = 'form-element image-element';
            if (element.src) {
                contentDiv.innerHTML = `<img src="${element.src}" alt="Bild">`;
            } else {
                contentDiv.innerHTML = `<p>Klicken Sie zum Hochladen</p>`;
            }
            break;
        case 'submit':
            const buttonFontSize = Math.min(defaultFontSize, 16); // Cap button font size at 16px
            contentDiv.innerHTML = `<button class="submit-button" style="font-family: ${defaultFontFamily} !important; font-size: ${buttonFontSize}px !important;">${element.label}</button>`;
            break;
    }
    
    // Insert content before resize handles
    div.insertBefore(contentDiv, div.firstChild);
}

function selectElement(element) {
    // Remove previous selection
    document.querySelectorAll('.form-element').forEach(el => el.classList.remove('selected'));
    
    selectedElement = element;
    document.getElementById(element.id).classList.add('selected');
    
    showProperties(element);
}

function showProperties(element) {
    let html = '';
    
    // Field Properties Section
    let fieldPropertiesContent = `
        <div class="property-group">
            <label>ID</label>
            <input type="text" value="${element.id}" disabled>
        </div>
    `;
    
    if (element.type !== 'image' && element.type !== 'staticText') {
        fieldPropertiesContent += `
            <div class="property-group">
                <label>Name</label>
                <input type="text" value="${element.name}" onchange="updateProperty('name', this.value)">
            </div>
            <div class="property-group">
                <label>Label</label>
                <input type="text" value="${element.label}" onchange="updateProperty('label', this.value)">
            </div>
        `;
    }
    
    if (element.type === 'text') {
        fieldPropertiesContent += `
            <div class="property-group">
                <label>Erforderlich</label>
                <input type="checkbox" ${element.required ? 'checked' : ''} onchange="updateProperty('required', this.checked)">
            </div>
        `;
    }
    
    if (element.type === 'staticText') {
        fieldPropertiesContent += `
            <div class="property-group">
                <label>Text</label>
                <textarea rows="4" onchange="updateProperty('value', this.value)">${element.value}</textarea>
            </div>
            <div class="property-group">
                <label>Schriftart</label>
                <select onchange="updateProperty('fontFamily', this.value)">
                    <option value="Arial" ${(element.fontFamily || defaultFontFamily) === 'Arial' ? 'selected' : ''}>Arial</option>
                    <option value="Times" ${(element.fontFamily || defaultFontFamily) === 'Times' ? 'selected' : ''}>Times New Roman</option>
                    <option value="Helvetica" ${(element.fontFamily || defaultFontFamily) === 'Helvetica' ? 'selected' : ''}>Helvetica</option>
                    <option value="Courier" ${(element.fontFamily || defaultFontFamily) === 'Courier' ? 'selected' : ''}>Courier</option>
                </select>
            </div>
            <div class="property-group">
                <label>Schriftgröße</label>
                <input type="number" min="8" max="72" value="${element.fontSize || defaultFontSize}" onchange="updateProperty('fontSize', this.value)">
            </div>
            <div class="property-group">
                <label>Formatierung</label>
                <div style="display: flex; gap: 5px; margin-top: 5px;">
                    <button type="button" onclick="formatText('bold')" style="padding: 5px 8px; border: 1px solid #ddd; background: white; font-weight: bold;">B</button>
                    <button type="button" onclick="formatText('italic')" style="padding: 5px 8px; border: 1px solid #ddd; background: white; font-style: italic;">I</button>
                    <button type="button" onclick="formatText('underline')" style="padding: 5px 8px; border: 1px solid #ddd; background: white; text-decoration: underline;">U</button>
                </div>
            </div>
        `;
    }
    
    if (element.type === 'dropdown' || element.type === 'radio' || element.type === 'checkbox') {
        fieldPropertiesContent += `
            <div class="property-group">
                <label>Optionen (eine pro Zeile)</label>
                <textarea rows="5" onchange="updateOptions(this.value)">${element.options.join('\n')}</textarea>
            </div>
        `;
    }
    
    if (element.type === 'submit') {
        fieldPropertiesContent += `
            <div class="property-group">
                <label>Aktion</label>
                <select onchange="updateProperty('action', this.value)">
                    <option value="email" ${element.action === 'email' ? 'selected' : ''}>E-Mail</option>
                    <option value="webhook" ${element.action === 'webhook' ? 'selected' : ''}>Webhook</option>
                </select>
            </div>
            <div class="property-group">
                <label>Ziel (E-Mail/URL)</label>
                <input type="text" value="${element.target || ''}" onchange="updateProperty('target', this.value)">
            </div>
        `;
    }
    
    html += `
        <div class="collapsible-section">
            <div class="collapsible-header" onclick="toggleCollapsible(this)">
                <span>⚙️ Feldeigenschaften</span>
                <span class="collapse-icon">▼</span>
            </div>
            <div class="collapsible-content">
                ${fieldPropertiesContent}
            </div>
        </div>
    `;
    
    html += `
        <div class="collapsible-section">
            <div class="collapsible-header collapsed" onclick="toggleCollapsible(this)">
                <span>📐 Position & Größe</span>
                <span class="collapse-icon">▶</span>
            </div>
            <div class="collapsible-content" style="display: none;">
                <div class="property-group">
                    <label>Position X</label>
                    <input type="number" value="${element.x}" onchange="updateProperty('x', parseInt(this.value))">
                </div>
                <div class="property-group">
                    <label>Position Y</label>
                    <input type="number" value="${element.y}" onchange="updateProperty('y', parseInt(this.value))">
                </div>
                <div class="property-group">
                    <label>Breite</label>
                    <input type="number" value="${element.width}" onchange="updateProperty('width', parseInt(this.value))">
                </div>
                <div class="property-group">
                    <label>Höhe</label>
                    <input type="number" value="${element.height}" onchange="updateProperty('height', parseInt(this.value))">
                </div>
            </div>
        </div>
        <div class="property-group">
            <button class="action-btn" onclick="deleteElement()">Element löschen</button>
        </div>
    `;
    
    propertiesPanel.innerHTML = html;
}

function updateProperty(property, value) {
    if (!selectedElement) return;
    
    // Save state for undo (but only for significant changes, not during dragging)
    if (property !== 'x' && property !== 'y') {
        saveState();
    }
    
    selectedElement[property] = value;
    const div = document.getElementById(selectedElement.id);
    
    if (property === 'x' || property === 'y' || property === 'width' || property === 'height') {
        div.style[property === 'x' ? 'left' : property === 'y' ? 'top' : property] = value + 'px';
    } else if (property === 'fontFamily' || property === 'fontSize') {
        // Handle font properties for text elements
        if (selectedElement.type === 'staticText') {
            const textDiv = div.querySelector('.wysiwyg-text');
            if (textDiv) {
                if (property === 'fontFamily') {
                    textDiv.style.fontFamily = value;
                } else if (property === 'fontSize') {
                    textDiv.style.fontSize = value + 'px';
                }
                // Save the current content to preserve formatting
                selectedElement.value = textDiv.innerHTML;
            }
        }
    } else {
        updateFormElementContent(div, selectedElement);
    }
}

function updateOptions(value) {
    if (!selectedElement) return;
    
    // Save state for undo
    saveState();
    
    selectedElement.options = value.split('\n').filter(opt => opt.trim());
    const div = document.getElementById(selectedElement.id);
    updateFormElementContent(div, selectedElement);
}

function deleteElement() {
    if (!selectedElement) return;
    
    const index = formElements.findIndex(el => el.id === selectedElement.id);
    if (index > -1) {
        formElements.splice(index, 1);
        document.getElementById(selectedElement.id).remove();
        selectedElement = null;
        propertiesPanel.innerHTML = '<p>Wählen Sie ein Element aus</p>';
    }
}

function startDrag(e) {
    if (e.target.classList.contains('resize-handle')) return;
    
    const element = e.currentTarget;
    const rect = element.getBoundingClientRect();
    const pageRect = page.getBoundingClientRect();
    
    // Find the element data that corresponds to this DOM element
    draggedElement = formElements.find(el => el.id === element.id);
    if (!draggedElement) return;
    
    isDragging = true;
    dragOffset.x = e.clientX - rect.left;
    dragOffset.y = e.clientY - rect.top;
    
    element.classList.add('dragging');
}

function startResize(e, position) {
    e.stopPropagation();
    isResizing = true;
    resizePosition = position;
}

document.addEventListener('mousemove', (e) => {
    if (isDragging && draggedElement) {
        const element = document.getElementById(draggedElement.id);
        const pageRect = page.getBoundingClientRect();
        
        let newX = e.clientX - pageRect.left - dragOffset.x;
        let newY = e.clientY - pageRect.top - dragOffset.y;
        
        // Snap to alignment
        const snapThreshold = 10;
        const elements = document.querySelectorAll('.form-element');
        let showHorizontal = false;
        let showVertical = false;
        
        elements.forEach(el => {
            if (el.id === draggedElement.id) return;
            
            const elRect = el.getBoundingClientRect();
            const elX = elRect.left - pageRect.left;
            const elY = elRect.top - pageRect.top;
            
            // Horizontal alignment
            if (Math.abs(newY - elY) < snapThreshold) {
                newY = elY;
                showHorizontal = true;
                horizontalLine.style.top = (elRect.top + window.scrollY) + 'px';
            }
            
            // Vertical alignment
            if (Math.abs(newX - elX) < snapThreshold) {
                newX = elX;
                showVertical = true;
                verticalLine.style.left = (elRect.left + window.scrollX) + 'px';
            }
        });
        
        horizontalLine.style.display = showHorizontal ? 'block' : 'none';
        verticalLine.style.display = showVertical ? 'block' : 'none';
        
        draggedElement.x = Math.max(0, newX);
        draggedElement.y = Math.max(0, newY);
        
        element.style.left = draggedElement.x + 'px';
        element.style.top = draggedElement.y + 'px';
        
        // Update properties if this is the selected element
        if (selectedElement && selectedElement.id === draggedElement.id) {
            showProperties(selectedElement);
        }
    }
    
    if (isResizing && selectedElement) {
        const element = document.getElementById(selectedElement.id);
        const pageRect = page.getBoundingClientRect();
        
        const mouseX = e.clientX - pageRect.left;
        const mouseY = e.clientY - pageRect.top;
        
        switch(resizePosition) {
            case 'se':
                selectedElement.width = Math.max(100, mouseX - selectedElement.x);
                selectedElement.height = Math.max(30, mouseY - selectedElement.y);
                break;
            case 'sw':
                const newWidth = Math.max(100, selectedElement.x + selectedElement.width - mouseX);
                selectedElement.x = mouseX;
                selectedElement.width = newWidth;
                selectedElement.height = Math.max(30, mouseY - selectedElement.y);
                break;
            case 'ne':
                selectedElement.width = Math.max(100, mouseX - selectedElement.x);
                const newHeight = Math.max(30, selectedElement.y + selectedElement.height - mouseY);
                selectedElement.y = mouseY;
                selectedElement.height = newHeight;
                break;
            case 'nw':
                const newW = Math.max(100, selectedElement.x + selectedElement.width - mouseX);
                const newH = Math.max(30, selectedElement.y + selectedElement.height - mouseY);
                selectedElement.x = mouseX;
                selectedElement.y = mouseY;
                selectedElement.width = newW;
                selectedElement.height = newH;
                break;
        }
        
        element.style.left = selectedElement.x + 'px';
        element.style.top = selectedElement.y + 'px';
        element.style.width = selectedElement.width + 'px';
        element.style.height = selectedElement.height + 'px';
        
        showProperties(selectedElement);
    }
});

document.addEventListener('mouseup', () => {
    isDragging = false;
    isResizing = false;
    draggedElement = null; // Clear dragged element reference
    horizontalLine.style.display = 'none';
    verticalLine.style.display = 'none';
    
    document.querySelectorAll('.form-element').forEach(el => {
        el.classList.remove('dragging');
    });
});

function editTextElement(element) {
    const div = document.getElementById(element.id);
    const textDiv = div.querySelector('.wysiwyg-text');
    
    if (textDiv) {
        // Save original content
        const originalContent = textDiv.innerHTML;
        
        // Make editable
        textDiv.contentEditable = true;
        textDiv.style.border = '2px solid #3498db';
        textDiv.style.outline = 'none';
        textDiv.style.padding = '5px';
        textDiv.focus();
        
        // Select all text if it's the placeholder
        if (textDiv.textContent === 'Doppelklick zum Bearbeiten') {
            document.execCommand('selectAll');
        }
        
        // Handle blur (when user clicks outside)
        const handleBlur = () => {
            textDiv.contentEditable = false;
            textDiv.style.border = 'none';
            textDiv.style.padding = '0';
            
            // Save content
            element.value = textDiv.innerHTML;
            if (!element.value.trim()) {
                textDiv.innerHTML = 'Doppelklick zum Bearbeiten';
            }
            
            textDiv.removeEventListener('blur', handleBlur);
            textDiv.removeEventListener('keydown', handleKeydown);
        };
        
        // Handle Enter and Escape keys
        const handleKeydown = (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                textDiv.blur();
            } else if (e.key === 'Escape') {
                textDiv.innerHTML = originalContent;
                textDiv.blur();
            }
        };
        
        textDiv.addEventListener('blur', handleBlur);
        textDiv.addEventListener('keydown', handleKeydown);
    }
}

function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
        if (selectedElement && selectedElement.type === 'image') {
            selectedElement.src = event.target.result;
            const div = document.getElementById(selectedElement.id);
            updateFormElementContent(div, selectedElement);
        }
    };
    reader.readAsDataURL(file);
}

page.addEventListener('click', (e) => {
    if (e.target === page) {
        selectedElement = null;
        document.querySelectorAll('.form-element').forEach(el => el.classList.remove('selected'));
        showGeneralProperties();
    }
});

function showGeneralProperties() {
    const currentPageData = pages.find(p => p.id === currentPage);
    
    propertiesPanel.innerHTML = `
        <div class="collapsible-section">
            <div class="collapsible-header" onclick="toggleCollapsible(this)">
                <span>📋 Formular-Eigenschaften</span>
                <span class="collapse-icon">▼</span>
            </div>
            <div class="collapsible-content">
                <div class="property-group">
                    <label>Formular Name</label>
                    <input type="text" value="${formName}" onchange="updateFormName(this.value)">
                </div>
                <div class="property-group">
                    <label>Anzahl Elemente</label>
                    <input type="text" value="${formElements.length}" disabled>
                </div>
                <div class="property-group">
                    <label>Seitengröße</label>
                    <input type="text" value="A4 (210 × 297 mm)" disabled>
                </div>
                <div class="property-group">
                    <label>Standard-Schriftart</label>
                    <select onchange="updateDefaultFont(this.value)">
                        <option value="Arial" ${defaultFontFamily === 'Arial' ? 'selected' : ''}>Arial</option>
                        <option value="Times" ${defaultFontFamily === 'Times' ? 'selected' : ''}>Times New Roman</option>
                        <option value="Helvetica" ${defaultFontFamily === 'Helvetica' ? 'selected' : ''}>Helvetica</option>
                        <option value="Courier" ${defaultFontFamily === 'Courier' ? 'selected' : ''}>Courier</option>
                    </select>
                </div>
                <div class="property-group">
                    <label>Standard-Schriftgröße</label>
                    <input type="number" min="8" max="72" value="${defaultFontSize}" onchange="updateDefaultFontSize(this.value)">
                </div>
            </div>
        </div>
        
        <div class="collapsible-section">
            <div class="collapsible-header" onclick="toggleCollapsible(this)">
                <span>📄 Seite ${currentPage} - Kopf & Fußzeile</span>
                <span class="collapse-icon">▼</span>
            </div>
            <div class="collapsible-content">
                <div class="property-group">
                    <label>Kopfzeile</label>
                    <textarea rows="2" placeholder="Text für Kopfzeile eingeben..." onchange="updatePageHeader(this.value)">${currentPageData?.header || ''}</textarea>
                </div>
                <div class="property-group">
                    <label>Fußzeile</label>
                    <textarea rows="2" placeholder="Text für Fußzeile eingeben..." onchange="updatePageFooter(this.value)">${currentPageData?.footer || ''}</textarea>
                </div>
                <div class="property-group">
                    <small style="color: #666;">Kopf- und Fußzeilen erscheinen nur im PDF-Export, nicht in der Vorschau.</small>
                </div>
            </div>
        </div>
    `;
}

function updateFormName(name) {
    formName = name || 'Neues Formular';
}

function updateDefaultFont(fontFamily) {
    defaultFontFamily = fontFamily || 'Arial';
    
    // Update all existing elements to use new default font
    formElements.forEach(element => {
        const div = document.getElementById(element.id);
        if (div) {
            updateFormElementContent(div, element);
        }
    });
}

function updateDefaultFontSize(fontSize) {
    defaultFontSize = parseInt(fontSize) || 12;
    
    // Update all existing elements to use new default font size
    formElements.forEach(element => {
        const div = document.getElementById(element.id);
        if (div) {
            updateFormElementContent(div, element);
        }
    });
}

function formatText(command) {
    if (!selectedElement || selectedElement.type !== 'staticText') {
        return;
    }
    
    const div = document.getElementById(selectedElement.id);
    const textDiv = div.querySelector('.wysiwyg-text');
    
    if (textDiv && textDiv.contentEditable === 'true') {
        // If currently editing, apply formatting to selection
        document.execCommand(command, false, null);
    } else {
        // If not editing, apply formatting to entire text
        const currentValue = selectedElement.value || '';
        let newValue = '';
        
        switch(command) {
            case 'bold':
                newValue = `<b>${currentValue}</b>`;
                break;
            case 'italic':
                newValue = `<i>${currentValue}</i>`;
                break;
            case 'underline':
                newValue = `<u>${currentValue}</u>`;
                break;
            default:
                return;
        }
        
        selectedElement.value = newValue;
        updateFormElementContent(div, selectedElement);
        showElementProperties(selectedElement);
    }
}

function updatePageHeader(header) {
    const pageData = pages.find(p => p.id === currentPage);
    if (pageData) {
        pageData.header = header;
        // Update preview
        loadPageElements();
    }
}

function updatePageFooter(footer) {
    const pageData = pages.find(p => p.id === currentPage);
    if (pageData) {
        pageData.footer = footer;
        // Update preview
        loadPageElements();
    }
}

// Image element click handler
page.addEventListener('click', (e) => {
    if (e.target.closest('.image-element') && !e.target.closest('.resize-handle')) {
        const element = formElements.find(el => el.id === e.target.closest('.image-element').id);
        if (element && element.type === 'image') {
            selectedElement = element;
            document.getElementById('imageFileInput').click();
        }
    }
});

async function exportToPDF() {
    const notificationId = showNotification('PDF Export', 'PDF wird erstellt...', 'info', 0, true);
    updateNotificationProgress(notificationId, 10);
    
    try {
        const { PDFDocument, rgb, StandardFonts } = PDFLib;
    
    const pdfDoc = await PDFDocument.create();
    
    // Helper function to get PDF font from font family name
    const getPDFFont = async (fontFamily) => {
        const normalizedFont = (fontFamily || defaultFontFamily).toLowerCase();
        switch (normalizedFont) {
            case 'times':
            case 'times new roman':
                return await pdfDoc.embedFont(StandardFonts.TimesRoman);
            case 'helvetica':
                return await pdfDoc.embedFont(StandardFonts.Helvetica);
            case 'courier':
            case 'courier new':
                return await pdfDoc.embedFont(StandardFonts.Courier);
            case 'arial':
            default:
                return await pdfDoc.embedFont(StandardFonts.Helvetica); // Arial fallback to Helvetica
        }
    };

    // Helper function to strip HTML tags and convert to plain text for PDF export
    const stripHtmlForPDF = (html) => {
        if (!html) return '';
        
        // Create a temporary div to parse HTML
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        
        // Get text content, which automatically strips HTML tags
        let text = tempDiv.textContent || tempDiv.innerText || '';
        
        return text;
    };
    
    // Add form fields
    const form = pdfDoc.getForm();
    
    // Embed default font for form fields
    let formDefaultFont;
    try {
        formDefaultFont = await getPDFFont(defaultFontFamily);
    } catch (e) {
        // Fallback to standard font
        formDefaultFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    }
    
    updateNotificationProgress(notificationId, 30);
    
    // Create pages and add elements
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        const pdfPage = pdfDoc.addPage([595, 842]); // A4 size
        
        
        // Get page data
        const pageData = pages.find(p => p.id === pageNum);
        const pageElements = formElements.filter(el => el.pageId === pageNum);
        
        // Add header if exists
        if (pageData?.header) {
            pdfPage.drawText(pageData.header, {
                x: 50,
                y: 800, // Lower position to avoid overlap
                size: 12,
                color: rgb(0, 0, 0)
            });
        }
        
        // Add footer if exists
        if (pageData?.footer) {
            pdfPage.drawText(pageData.footer, {
                x: 50,
                y: 50, // Higher position to avoid overlap
                size: 10,
                color: rgb(0.5, 0.5, 0.5)
            });
        }
        
        // Define safe area for elements
        const topMargin = pageData?.header ? 780 : 820; // If header exists, start lower
        const bottomMargin = pageData?.footer ? 70 : 30; // If footer exists, end higher
        
        for (const element of pageElements) {
            // Add horizontal padding to create space between fields
            const horizontalPadding = 5; // 5 points padding on each side
            const x = element.x * 0.75 + horizontalPadding; // Convert pixels to PDF points and add padding
            
            // Reserve space for labels by adjusting Y coordinate
            let labelSpace = 0;
            if ((element.type === 'text' || element.type === 'dropdown') && element.label) {
                labelSpace = 20; // Reserve 20 points for label space
            }
            
            let y = 842 - (element.y + element.height) * 0.75 - labelSpace; // Flip Y coordinate and reserve label space
            const width = Math.max(element.width * 0.75 - (horizontalPadding * 2), 50); // Reduce width by padding, minimum 50 points
            const height = element.height * 0.75;
            
            // Create unique field name to avoid conflicts with timestamp
            const timestamp = Date.now();
            const fieldName = `${element.name}_p${pageNum}_${element.id}_${timestamp}`;
            
            // Check if element would be outside safe area
            if (y + height > topMargin) {
                // Element would overlap with header area
                continue;
            }
            
            if (y < bottomMargin) {
                // Element would overlap with footer area
                continue;
            }
        
        switch(element.type) {
            case 'text':
                // Draw label above the field
                if (element.label) {
                    const labelY = y + height + 5; // Place label above field with minimal spacing
                    // Check if label would overlap with header
                    if (labelY <= topMargin) {
                        const labelFont = await getPDFFont(defaultFontFamily);
                        pdfPage.drawText(element.label, {
                            x: x,
                            y: labelY,
                            size: Math.min(defaultFontSize * 0.7, 9), // Reduce label font size significantly
                            font: labelFont,
                            color: rgb(0, 0, 0)
                        });
                    }
                }
                const textField = form.createTextField(fieldName);
                
                // Add to page first
                textField.addToPage(pdfPage, { x, y, width, height });
                
                // Then set properties and appearance
                const fieldFontSize = Math.min(defaultFontSize * 0.8, 10);
                textField.setText(element.value || '');
                
                try {
                    // Set font size first
                    textField.setFontSize(fieldFontSize);
                    
                    // Force update appearances with the font
                    textField.updateAppearances(formDefaultFont);
                    
                    // If the field still has issues, try setting a default value
                    if (!element.value) {
                        textField.setText(' '); // Set a space to force appearance generation
                        textField.setText(''); // Then clear it
                    }
                } catch (e) {
                    console.warn('Text field appearance warning:', e);
                }
                break;
                
            case 'dropdown':
                // Draw label above the field
                if (element.label) {
                    const labelY = y + height + 5; // Place label above field with minimal spacing
                    // Check if label would overlap with header
                    if (labelY <= topMargin) {
                        const labelFont = await getPDFFont(defaultFontFamily);
                        pdfPage.drawText(element.label, {
                            x: x,
                            y: labelY,
                            size: Math.min(defaultFontSize * 0.7, 9), // Reduce label font size significantly
                            font: labelFont,
                            color: rgb(0, 0, 0)
                        });
                    }
                }
                const dropdown = form.createDropdown(fieldName);
                dropdown.addOptions(element.options);
                
                // Add to page first
                dropdown.addToPage(pdfPage, { x, y, width, height });
                
                // Then set properties and appearance
                const dropdownFontSize = Math.min(defaultFontSize * 0.8, 10);
                
                try {
                    // Set font size first
                    dropdown.setFontSize(dropdownFontSize);
                    
                    // Force update appearances with the font
                    dropdown.updateAppearances(formDefaultFont);
                    
                    // Select first option to force appearance generation
                    if (element.options && element.options.length > 0) {
                        dropdown.select(element.options[0]);
                    }
                } catch (e) {
                    console.warn('Dropdown appearance warning:', e);
                }
                break;
                
            case 'checkbox':
                // Draw label above the checkbox group
                if (element.label) {
                    const labelFont = await getPDFFont(defaultFontFamily);
                    pdfPage.drawText(element.label, {
                        x: x,
                        y: y + height + 5,
                        size: Math.min(defaultFontSize * 0.7, 9), // Reduce label font size significantly
                        font: labelFont,
                        color: rgb(0, 0, 0)
                    });
                }
                element.options.forEach(async (opt, i) => {
                    const checkbox = form.createCheckBox(`${fieldName}_${i}`);
                    
                    // Set appearance before adding to page
                    try {
                        const checkboxFontSize = Math.min(defaultFontSize * 0.7, 8);
                        checkbox.setFontSize(checkboxFontSize);
                        checkbox.updateAppearances(formDefaultFont);
                        checkbox.defaultUpdateAppearances(formDefaultFont);
                    } catch (e) {
                        // Fallback for checkbox appearance
                        try {
                            checkbox.setFontSize(8);
                        } catch (e2) {
                            // Font size might not be supported
                        }
                    }
                    
                    checkbox.addToPage(pdfPage, { 
                        x: x, 
                        y: y - (i * 20), // Reduce spacing between checkboxes
                        width: 15, // Smaller checkbox size
                        height: 15 
                    });
                    // Draw option label next to checkbox
                    const optionFont = await getPDFFont(defaultFontFamily);
                    pdfPage.drawText(opt, {
                        x: x + 20, // Closer to checkbox
                        y: y - (i * 20) + 4, // Adjust for new spacing
                        size: Math.min(Math.max(7, defaultFontSize * 0.6), 8), // Much smaller option labels
                        font: optionFont,
                        color: rgb(0, 0, 0)
                    });
                });
                break;
                
            case 'radio':
                // Draw label above the radio group
                if (element.label) {
                    const labelFont = await getPDFFont(defaultFontFamily);
                    pdfPage.drawText(element.label, {
                        x: x,
                        y: y + height + 5,
                        size: Math.min(defaultFontSize * 0.7, 9), // Reduce label font size significantly
                        font: labelFont,
                        color: rgb(0, 0, 0)
                    });
                }
                const radioGroup = form.createRadioGroup(fieldName);
                
                // Set appearance for radio group
                try {
                    const radioFontSize = Math.min(defaultFontSize * 0.7, 8);
                    radioGroup.setFontSize(radioFontSize);
                    radioGroup.updateAppearances(formDefaultFont);
                    radioGroup.defaultUpdateAppearances(formDefaultFont);
                } catch (e) {
                    // Fallback for radio group appearance
                    try {
                        radioGroup.setFontSize(8);
                    } catch (e2) {
                        // Font size might not be supported
                    }
                }
                
                element.options.forEach(async (opt, i) => {
                    radioGroup.addOptionToPage(opt, pdfPage, { 
                        x: x, 
                        y: y - (i * 20), // Reduce spacing between radio buttons
                        width: 15, // Smaller radio button size
                        height: 15 
                    });
                    // Draw option label next to radio button
                    const optionFont = await getPDFFont(defaultFontFamily);
                    pdfPage.drawText(opt, {
                        x: x + 20, // Closer to radio button
                        y: y - (i * 20) + 4, // Adjust for new spacing
                        size: Math.min(Math.max(7, defaultFontSize * 0.6), 8), // Much smaller option labels
                        font: optionFont,
                        color: rgb(0, 0, 0)
                    });
                });
                break;
                
            case 'staticText':
                try {
                    const font = await getPDFFont(element.fontFamily);
                    const textContent = stripHtmlForPDF(element.value || '');
                    const fontSize = Math.min(parseInt(element.fontSize) || defaultFontSize, 14); // Cap static text at 14pt
                    
                    // Handle multi-line text by splitting on newlines
                    const lines = textContent.split('\n');
                    const lineHeight = fontSize * 1.2;
                    
                    lines.forEach((line, index) => {
                        if (line.trim()) { // Only draw non-empty lines
                            pdfPage.drawText(line, {
                                x: x,
                                y: y + height - 15 - (index * lineHeight),
                                size: fontSize,
                                font: font,
                                color: rgb(0, 0, 0)
                            });
                        }
                    });
                } catch (error) {
                    console.error('Error drawing static text:', error);
                    // Fallback: draw simple text without formatting
                    const fallbackFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
                    pdfPage.drawText(stripHtmlForPDF(element.value || ''), {
                        x: x,
                        y: y + height - 15,
                        size: defaultFontSize,
                        font: fallbackFont,
                        color: rgb(0, 0, 0)
                    });
                }
                break;
                
            case 'image':
                if (element.src) {
                    try {
                        const imageBytes = await fetch(element.src).then(res => res.arrayBuffer());
                        const image = element.src.includes('data:image/png') ? 
                            await pdfDoc.embedPng(imageBytes) : 
                            await pdfDoc.embedJpg(imageBytes);
                        pdfPage.drawImage(image, { x, y, width, height });
                    } catch (error) {
                        console.error('Error embedding image:', error);
                    }
                }
                break;
                
            case 'submit':
                // Draw submit button as static text since pdf-lib buttons have issues
                pdfPage.drawRectangle({
                    x: x,
                    y: y,
                    width: width,
                    height: height,
                    borderColor: rgb(0.2, 0.2, 0.2),
                    borderWidth: 1,
                    color: rgb(0.9, 0.9, 0.9)
                });
                const buttonFont = await getPDFFont(defaultFontFamily);
                pdfPage.drawText(element.label || 'Senden', {
                    x: x + width / 2 - (element.label?.length || 6) * 3,
                    y: y + height / 2 - 6,
                    size: Math.min(defaultFontSize * 0.8, 11), // Reduce button font size
                    font: buttonFont,
                    color: rgb(0, 0, 0)
                });
                break;
            }
        }
    }
    
    updateNotificationProgress(notificationId, 70);
    
    // Embed form configuration as PDF metadata
    const config = {
        formName: formName,
        formElements: formElements,
        pageSettings: {
            width: 794,
            height: 1123
        }
    };
    
    // Add configuration as custom property
    pdfDoc.setTitle(formName);
    pdfDoc.setSubject('PDF Formular Ersteller Configuration');
    pdfDoc.setKeywords(['form-creator-config', JSON.stringify(config)]);
    
    updateNotificationProgress(notificationId, 90);
    
    const pdfBytes = await pdfDoc.save();
    
    // Generate filename with current date
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD format
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-'); // HH-MM-SS format
    const safeFormName = formName.replace(/[^a-z0-9äöüß\s]/gi, '').replace(/\s+/g, '_');
    const filename = `${safeFormName}_${dateStr}_${timeStr}.pdf`;
    
    // Download the PDF with enhanced error handling
    try {
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        
        // Add to DOM temporarily to ensure proper event handling
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        // Clean up URL object after a delay
        setTimeout(() => {
            URL.revokeObjectURL(url);
        }, 100);
    } catch (downloadError) {
        console.error('PDF download error:', downloadError);
        hideNotification(notificationId);
        showNotification('Download fehlgeschlagen', 'PDF konnte nicht heruntergeladen werden. Versuchen Sie es erneut.', 'error');
        return;
    }
    
    updateNotificationProgress(notificationId, 100);
    setTimeout(() => {
        hideNotification(notificationId);
        showNotification('Export erfolgreich', `PDF wurde als "${filename}" heruntergeladen`, 'success');
    }, 500);
    
    // Clear unsaved changes warning after successful export
    clearUnsavedChangesWarning();
    
    } catch (error) {
        console.error('PDF export error:', error);
        hideNotification(notificationId);
        showNotification('Export fehlgeschlagen', 'Fehler beim Erstellen der PDF: ' + error.message, 'error');
    }
}

// Page Management Functions
function updatePageNavigation() {
    const pageInfo = document.getElementById('pageInfo');
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');
    const deleteBtn = document.getElementById('deletePage');
    
    pageInfo.textContent = `Seite ${currentPage} von ${totalPages}`;
    
    prevBtn.disabled = currentPage <= 1;
    nextBtn.disabled = currentPage >= totalPages;
    deleteBtn.disabled = totalPages <= 1;
}

function previousPage() {
    if (currentPage > 1) {
        saveCurrentPageElements();
        currentPage--;
        loadPageElements();
        updatePageNavigation();
    }
}

function nextPage() {
    if (currentPage < totalPages) {
        saveCurrentPageElements();
        currentPage++;
        loadPageElements();
        updatePageNavigation();
    }
}

function addNewPage() {
    saveCurrentPageElements();
    
    totalPages++;
    const newPageId = totalPages;
    pages.push({ id: newPageId, elements: [], header: '', footer: '' });
    
    currentPage = newPageId;
    loadPageElements();
    updatePageNavigation();
}

function deletePage() {
    if (totalPages <= 1) return;
    
    // Remove page from pages array
    const pageIndex = pages.findIndex(p => p.id === currentPage);
    if (pageIndex > -1) {
        // Remove elements from this page from formElements
        const pageData = pages[pageIndex];
        pageData.elements.forEach(element => {
            const elemIndex = formElements.findIndex(el => el.id === element.id);
            if (elemIndex > -1) {
                formElements.splice(elemIndex, 1);
            }
        });
        
        pages.splice(pageIndex, 1);
    }
    
    totalPages--;
    
    // Adjust current page if necessary
    if (currentPage > totalPages) {
        currentPage = totalPages;
    }
    
    // Renumber pages
    pages.forEach((pageData, index) => {
        pageData.id = index + 1;
    });
    
    loadPageElements();
    updatePageNavigation();
    updateElementOrderList();
}

function saveCurrentPageElements() {
    const pageData = pages.find(p => p.id === currentPage);
    if (pageData) {
        pageData.elements = formElements.filter(el => el.pageId === currentPage);
    }
}

function loadPageElements() {
    // Clear current page
    page.innerHTML = '';
    selectedElement = null;
    
    // Load elements for current page
    const pageData = pages.find(p => p.id === currentPage);
    
    // Add header/footer preview if exists
    if (pageData?.header) {
        const headerDiv = document.createElement('div');
        headerDiv.className = 'page-header-preview';
        headerDiv.textContent = pageData.header;
        page.appendChild(headerDiv);
    }
    
    if (pageData?.footer) {
        const footerDiv = document.createElement('div');
        footerDiv.className = 'page-footer-preview';
        footerDiv.textContent = pageData.footer;
        page.appendChild(footerDiv);
    }
    
    if (pageData) {
        pageData.elements.forEach(element => {
            createFormElementDOM(element);
        });
    }
    
    showGeneralProperties();
}

async function importFromPDF(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
        const arrayBuffer = await file.arrayBuffer();
        const { PDFDocument } = PDFLib;
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        
        // Read metadata
        const keywords = pdfDoc.getKeywords();
        const subject = pdfDoc.getSubject();
        
        // Check if this is a form creator PDF
        if (subject !== 'PDF Formular Ersteller Configuration') {
            showNotification('PDF Import Fehler', 'Diese PDF-Datei wurde nicht mit dem Formular Ersteller erstellt oder enthält keine Konfiguration.', 'error');
            return;
        }
        
        // Extract configuration from keywords
        let configData = null;
        if (Array.isArray(keywords)) {
            // Keywords is an array
            const configKeyword = keywords.find(k => k.startsWith('{'));
            if (configKeyword) {
                configData = configKeyword;
            }
        } else if (typeof keywords === 'string') {
            // Keywords is a string, look for JSON in it
            const match = keywords.match(/\{.*\}/);
            if (match) {
                configData = match[0];
            }
        }
        
        if (!configData) {
            showNotification('Konfiguration fehlt', 'Keine Konfigurationsdaten in der PDF gefunden.', 'warning');
            return;
        }
        
        const config = JSON.parse(configData);
        
        // Clear existing elements
        page.innerHTML = '';
        formElements = [];
        
        // Load elements and form name
        if (config.formElements) {
            // Reset element ID counter
            elementIdCounter = 0;
            
            // Regenerate IDs for all elements to avoid conflicts
            formElements = config.formElements.map(element => {
                const newElement = {...element};
                newElement.id = `element_${elementIdCounter++}`;
                return newElement;
            });
            
            formElements.forEach(element => {
                createFormElementDOM(element);
            });
            updateElementOrderList();
        }
        
        // Restore form name
        if (config.formName) {
            formName = config.formName;
        }
        
        // Show general properties if no element is selected
        showGeneralProperties();
        
        showNotification('Import erfolgreich', 'Konfiguration erfolgreich aus PDF geladen!', 'success');
    } catch (error) {
        console.error('Error loading PDF:', error);
        showNotification('Import fehlgeschlagen', 'Fehler beim Laden der PDF-Konfiguration: ' + error.message, 'error');
    }
}

function toggleGrid() {
    gridVisible = !gridVisible;
    const gridBtn = document.getElementById('toggleGrid');
    
    if (gridVisible) {
        page.classList.remove('no-grid');
        gridBtn.classList.add('active');
    } else {
        page.classList.add('no-grid');
        gridBtn.classList.remove('active');
    }
}

function updateElementOrderList() {
    if (formElements.length === 0) {
        elementOrderList.innerHTML = '<p>Keine Elemente</p>';
        return;
    }
    
    let html = '';
    formElements.forEach((element, index) => {
        html += `
            <div class="element-order-item" data-id="${element.id}" onclick="selectElementFromOrder('${element.id}')">
                <span>${element.label || element.type}</span>
                <div class="order-controls">
                    <button class="order-btn" onclick="moveElementUp(${index})" ${index === 0 ? 'disabled' : ''}>↑</button>
                    <button class="order-btn" onclick="moveElementDown(${index})" ${index === formElements.length - 1 ? 'disabled' : ''}>↓</button>
                </div>
            </div>
        `;
    });
    
    elementOrderList.innerHTML = html;
}

function selectElementFromOrder(elementId) {
    const element = formElements.find(el => el.id === elementId);
    if (element) {
        selectElement(element);
        
        // Update order list selection
        document.querySelectorAll('.element-order-item').forEach(item => {
            item.classList.remove('selected');
        });
        document.querySelector(`[data-id="${elementId}"]`).classList.add('selected');
    }
}

function moveElementUp(index) {
    if (index > 0) {
        [formElements[index], formElements[index - 1]] = [formElements[index - 1], formElements[index]];
        updateElementOrderList();
        updateTabOrder();
    }
}

function moveElementDown(index) {
    if (index < formElements.length - 1) {
        [formElements[index], formElements[index + 1]] = [formElements[index + 1], formElements[index]];
        updateElementOrderList();
        updateTabOrder();
    }
}

function updateTabOrder() {
    formElements.forEach((element, index) => {
        const domElement = document.getElementById(element.id);
        if (domElement) {
            domElement.style.zIndex = index + 1;
        }
    });
}

// Update delete function to refresh order list
const originalDeleteElement = deleteElement;
deleteElement = function() {
    if (!selectedElement) return;
    
    // Save state for undo
    saveState();
    
    const index = formElements.findIndex(el => el.id === selectedElement.id);
    if (index > -1) {
        formElements.splice(index, 1);
        document.getElementById(selectedElement.id).remove();
        selectedElement = null;
        showGeneralProperties();
        updateElementOrderList();
    }
};

// Format text function for WYSIWYG text elements
function formatText(command) {
    if (!selectedElement || selectedElement.type !== 'staticText') return;
    
    const div = document.getElementById(selectedElement.id);
    const textDiv = div.querySelector('.wysiwyg-text');
    
    if (textDiv && textDiv.isContentEditable) {
        // If currently editing, apply formatting to selection
        document.execCommand(command, false, null);
    } else {
        // If not editing, toggle the formatting on the entire text
        const currentContent = selectedElement.value || 'Doppelklick zum Bearbeiten';
        let formattedContent = currentContent;
        
        switch(command) {
            case 'bold':
                if (formattedContent.includes('<b>') || formattedContent.includes('<strong>')) {
                    formattedContent = formattedContent.replace(/<\/?b>/g, '').replace(/<\/?strong>/g, '');
                } else {
                    formattedContent = `<strong>${formattedContent}</strong>`;
                }
                break;
            case 'italic':
                if (formattedContent.includes('<i>') || formattedContent.includes('<em>')) {
                    formattedContent = formattedContent.replace(/<\/?i>/g, '').replace(/<\/?em>/g, '');
                } else {
                    formattedContent = `<em>${formattedContent}</em>`;
                }
                break;
            case 'underline':
                if (formattedContent.includes('<u>')) {
                    formattedContent = formattedContent.replace(/<\/?u>/g, '');
                } else {
                    formattedContent = `<u>${formattedContent}</u>`;
                }
                break;
        }
        
        // Update the element value and DOM
        selectedElement.value = formattedContent;
        updateFormElementContent(div, selectedElement);
        
        // Save state for undo
        saveState();
    }
}

// Global functions for property updates
window.updateProperty = updateProperty;
window.updateOptions = updateOptions;
window.deleteElement = deleteElement;
window.selectElementFromOrder = selectElementFromOrder;
window.moveElementUp = moveElementUp;
window.moveElementDown = moveElementDown;
window.updateFormName = updateFormName;
window.toggleCollapsible = toggleCollapsible;
window.updatePageHeader = updatePageHeader;
window.updatePageFooter = updatePageFooter;
window.formatText = formatText;
window.updateDefaultFont = updateDefaultFont;
window.updateDefaultFontSize = updateDefaultFontSize;

function openAboutModal() {
    document.getElementById('aboutModal').style.display = 'block';
}

function closeAboutModal() {
    document.getElementById('aboutModal').style.display = 'none';
}

// Close modal when clicking outside of it
window.addEventListener('click', (e) => {
    const modal = document.getElementById('aboutModal');
    if (e.target === modal) {
        closeAboutModal();
    }
});

// Keyboard event handler
function handleKeyDown(e) {
    // Ignore if typing in input field
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
    }
    
    switch(e.key) {
        case 'Delete':
        case 'Backspace':
            if (selectedElement) {
                deleteElement();
                e.preventDefault();
            }
            break;
            
        case 'z':
        case 'Z':
            if (e.ctrlKey || e.metaKey) {
                if (e.shiftKey) {
                    redo();
                } else {
                    undo();
                }
                e.preventDefault();
            }
            break;
            
        case 'y':
        case 'Y':
            if (e.ctrlKey || e.metaKey) {
                redo();
                e.preventDefault();
            }
            break;
    }
}

// Undo/Redo system
function saveState() {
    const state = {
        formElements: JSON.parse(JSON.stringify(formElements)),
        elementIdCounter: elementIdCounter,
        formName: formName
    };
    
    undoStack.push(state);
    
    // Limit undo stack size
    if (undoStack.length > maxUndoSteps) {
        undoStack.shift();
    }
    
    // Clear redo stack when new action is performed
    redoStack = [];
    
    updateUndoRedoButtons();
}

function undo() {
    if (undoStack.length === 0) return;
    
    // Save current state to redo stack
    const currentState = {
        formElements: JSON.parse(JSON.stringify(formElements)),
        elementIdCounter: elementIdCounter,
        formName: formName
    };
    redoStack.push(currentState);
    
    // Restore previous state
    const previousState = undoStack.pop();
    restoreState(previousState);
    
    updateUndoRedoButtons();
}

function redo() {
    if (redoStack.length === 0) return;
    
    // Save current state to undo stack
    const currentState = {
        formElements: JSON.parse(JSON.stringify(formElements)),
        elementIdCounter: elementIdCounter,
        formName: formName
    };
    undoStack.push(currentState);
    
    // Restore next state
    const nextState = redoStack.pop();
    restoreState(nextState);
    
    updateUndoRedoButtons();
}

function restoreState(state) {
    // Clear existing elements
    page.innerHTML = '';
    
    // Restore state
    formElements = state.formElements;
    elementIdCounter = state.elementIdCounter;
    formName = state.formName;
    selectedElement = null;
    
    // Recreate DOM elements
    formElements.forEach(element => {
        createFormElementDOM(element);
    });
    
    updateElementOrderList();
    showGeneralProperties();
}

function toggleCollapsible(header) {
    const content = header.nextElementSibling;
    const icon = header.querySelector('.collapse-icon');
    
    if (content.style.display === 'none') {
        content.style.display = 'block';
        icon.textContent = '▼';
        header.classList.remove('collapsed');
    } else {
        content.style.display = 'none';
        icon.textContent = '▶';
        header.classList.add('collapsed');
    }
}

function updateUndoRedoButtons() {
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');
    
    // Update undo button
    if (undoStack.length === 0) {
        undoBtn.disabled = true;
        undoBtn.style.opacity = '0.5';
    } else {
        undoBtn.disabled = false;
        undoBtn.style.opacity = '1';
    }
    
    // Update redo button
    if (redoStack.length === 0) {
        redoBtn.disabled = true;
        redoBtn.style.opacity = '0.5';
    } else {
        redoBtn.disabled = false;
        redoBtn.style.opacity = '1';
    }
}

// Warn user when leaving page with unsaved changes
window.addEventListener('beforeunload', (e) => {
    if (formElements.length > 0) {
        const message = 'Sie haben ungespeicherte Änderungen. Möchten Sie die Seite wirklich verlassen?';
        e.returnValue = message; // For older browsers
        return message; // For modern browsers
    }
});

// Clear warning after successful PDF export
function clearUnsavedChangesWarning() {
    // Remove the beforeunload listener temporarily
    const originalHandler = window.onbeforeunload;
    window.onbeforeunload = null;
    
    // Restore after a short delay to catch any new changes
    setTimeout(() => {
        window.onbeforeunload = originalHandler;
    }, 1000);
}