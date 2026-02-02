# Contact Section CSS Reference

## Component Structure
The contact section uses these CSS classes (in order of application):

```tsx
<div className="detail-section modal-contact-section modal-header-with-photo">
  <div className="modal-photo-container">...</div>
  <div className="detail-section-relative">
    <div className="detail-grid">...</div>
  </div>
</div>
```

## CSS Classes Involved

### 1. `.modal-header-with-photo` (from `src/styles/index.css`)
- **Purpose**: Main flex container for photo + contact info
- **Key properties**:
  - `display: flex`
  - `gap: 24px` (space between photo and contact)
  - `align-items: flex-start`
  - `padding: 20px` (top/left/right)
  - `background: #fafafa`
  - `border-radius: 8px`

### 2. `.modal-contact-section` (from `src/styles/index.css`)
- **Purpose**: The contact info column (right side)
- **Key properties**:
  - `flex: 1` (takes remaining space)
  - `min-width: 0` (allows flex shrinking)

### 3. `.modal-photo-container` (from `src/styles/index.css`)
- **Purpose**: Photo column container (left side)
- **Key properties**:
  - `width: 270px` (default)
  - `flex-shrink: 0`
  - `align-self: stretch` (stretches to match height)

### 4. Panel-Specific Overrides (from `src/components/views/ClientDetailPanel.css`)

#### `.client-detail-panel-body .modal-header-with-photo`
- Removes left/right padding
- Sets gap to 32px
- Aligns items to flex-start

#### `.client-detail-panel-body .modal-photo-container`
- **Overrides width to 200px** with !important
- Prevents flex growth/shrink
- Changes align-self to flex-start

#### `.client-detail-panel-body .modal-contact-section`
- Ensures flex: 1
- Sets max-width: none

## Potential Issues

1. **Conflicting flex properties**: The `!important` flags might be too aggressive
2. **Width constraints**: Multiple width settings might conflict
3. **Flex layout**: The parent container needs proper flex setup

## Current Override Chain

1. Base styles in `index.css` set photo container to 270px
2. Panel CSS tries to override to 200px with !important
3. But the column might still be taking more space due to flex behavior
