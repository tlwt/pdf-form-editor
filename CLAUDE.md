# PDF Form Creator - Architecture Documentation

## Overview
A browser-based PDF form creator that works entirely client-side. No server required, all processing happens in the browser using JavaScript and pdf-lib.

## File Structure

### Core Files
- **index.html** - Main application structure, toolbar, modals
- **styles.css** - Complete styling, responsive design, WYSIWYG styles
- **script.js** - Core application logic (~1500+ lines)

## Key Architecture Components

### 1. Data Model

#### Global Variables (script.js:1-17)
```javascript
let formElements = [];           // All form elements across pages
let pages = [];                 // Page data with elements, headers, footers
let selectedElement = null;     // Currently selected element
let currentPage = 1;           // Active page number
let formName = 'Neues Formular'; // Form title
let defaultFontFamily = 'Arial'; // Default font
let defaultFontSize = 12;       // Default font size
```

#### Element Structure
```javascript
{
    id: 'element_X',
    type: 'text|dropdown|radio|checkbox|staticText|image|submit',
    x: number,                  // Position X
    y: number,                  // Position Y  
    width: number,              // Width in pixels
    height: number,             // Height in pixels
    label: string,              // Display label
    name: string,               // Field name
    required: boolean,          // Required flag
    value: string,              // Content/value
    options: string[],          // For dropdowns/radio/checkbox
    pageId: number,            // Which page element belongs to
    fontFamily: string,        // Font family (for staticText)
    fontSize: number           // Font size (for staticText)
}
```

### 2. Core Functions by Area

#### Element Management (script.js:55-160)
- **addFormElement(type)** - Creates new form elements
- **findFreePosition(width, height)** - Smart positioning avoiding overlaps
- **createFormElementDOM(element)** - Creates DOM representation
- **updateFormElementContent(div, element)** - Updates element content

#### Properties Panel (script.js:280-400)
- **showElementProperties(element)** - Shows element-specific properties
- **showGeneralProperties()** - Shows page/form properties (auto-loads on startup)
- **updateProperty(property, value)** - Updates element properties with undo support

#### Text Editing & WYSIWYG (script.js:569-785)
- **editTextElement(element)** - Inline WYSIWYG editing with contenteditable
- **formatText(command)** - Bold, italic, underline formatting
- **updateDefaultFont/Size()** - Global font defaults

#### Page Management (script.js:1100-1200)
- **addNewPage()** - Creates new pages
- **deletePage()** - Removes pages
- **switchToPage(pageId)** - Page navigation
- **updatePageNavigation()** - Updates page controls

#### PDF Export/Import (script.js:810-1050)
- **exportToPDF()** - Creates fillable PDF with embedded config
- **importFromPDF()** - Reads PDF and extracts configuration
- **getPDFFont()** - Maps fonts to PDF-lib standard fonts

#### Undo/Redo System (script.js:1300-1350)
- **saveState()** - Saves current state to undo stack
- **undo()** / **redo()** - State restoration
- **restoreState(state)** - Restores elements and UI

#### Drag & Drop System (script.js:450-560)
- **Drag handling** - Element positioning with alignment guides
- **Resize handling** - Corner handles for element resizing
- **Alignment system** - Visual guides and grid snapping

### 3. UI Components

#### Toolbar (index.html:12-46)
- Element creation buttons (text, dropdown, radio, etc.)
- Action buttons (export, import, undo, redo)
- Grid toggle and about modal

#### Properties Panel (index.html:61-73)
- **General Properties** - Form name, page headers/footers, font defaults
- **Element Properties** - Type-specific configuration
- **Element Order** - Tab order management

#### Page Canvas (index.html:49-59)
- **Page Navigation** - Previous/next, add/delete pages
- **Canvas Area** - Visual form builder with grid
- **Header/Footer Preview** - Shows page headers/footers

### 4. Key Features

#### WYSIWYG Text Editing
- Double-click to edit text inline
- Bold, italic, underline formatting
- Font family and size controls
- Enter to save, Escape to cancel

#### Multi-Page Support
- Independent element positioning per page
- Page-specific headers and footers
- Page navigation controls

#### Smart Positioning
- Automatic free position finding
- Grid snapping and alignment guides
- Overlap prevention

#### PDF Integration
- Configuration embedded in PDF metadata
- Fillable form fields generated
- Font properties preserved in export

### 5. CSS Architecture (styles.css)

#### Layout (lines 1-120)
- Flexbox-based responsive layout
- Toolbar and editor container structure

#### Form Elements (lines 227-338)
- Element styling and selection states
- Resize handles and drag indicators
- WYSIWYG text editing styles (lines 582-602)

#### Properties Panel (lines 284-440)
- Collapsible sections
- Form controls styling

#### Modals & Navigation (lines 446-580)
- About modal styling
- Page navigation controls

### 6. Event Handling

#### Initialization (script.js:24-58)
- Toolbar button listeners
- Keyboard shortcuts (Ctrl+Z, Ctrl+Y, Delete)
- Auto-load page properties on startup

#### Element Interaction
- Click to select elements
- Double-click for text editing
- Drag for positioning, resize handles for sizing

### 7. State Management

#### Undo/Redo Stack
- Saves full application state
- Triggered on significant changes (not positioning)
- Max 50 steps

#### Page State
- Elements stored per page
- Current page tracking
- Page-specific headers/footers

## Common Modification Patterns

### Adding New Element Types
1. Update `addFormElement()` - add new type case
2. Update `updateFormElementContent()` - add rendering logic
3. Update `showElementProperties()` - add properties panel
4. Update PDF export - add export logic

### Adding New Properties
1. Add to element creation in `addFormElement()`
2. Add UI controls in properties panel
3. Handle in `updateProperty()` function
4. Update PDF export if needed

### Modifying UI Layout
1. Update HTML structure in `index.html`
2. Add CSS styles in `styles.css`
3. Update event listeners in script initialization

## Performance Considerations
- All processing is client-side
- Large forms may impact browser performance
- PDF generation is memory-intensive for many pages
- Undo stack limited to 50 steps to prevent memory issues

## Security & Privacy
- No data transmission - fully offline capable
- No cookies or tracking
- All data stays in browser memory
- Configuration embedded in PDF for portability