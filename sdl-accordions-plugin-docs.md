# SDL Accordions Plugin — Full Documentation

> A sophisticated, configurable accordion plugin for Squarespace sites. Built as a vanilla JS class (`sdlAccordions`), it integrates deeply with Squarespace's lifecycle, supports two distinct installation methods, and exposes a comprehensive CSS custom property API for styling.

---

## Table of Contents

1. [How the Plugin Works](#how-the-plugin-works)
2. [Installation Methods](#installation-methods)
3. [All Features](#all-features)
4. [Configuration Reference](#configuration-reference)
5. [CSS Custom Properties (Styling API)](#css-custom-properties-styling-api)
6. [JavaScript Events API](#javascript-events-api)
7. [URL & Hash Navigation](#url--hash-navigation)
8. [Squarespace Integration Details](#squarespace-integration-details)
9. [Adding the Plugin to Squarespace](#adding-the-plugin-to-squarespace)
10. [Advanced Usage Patterns](#advanced-usage-patterns)
11. [Accessibility](#accessibility)
12. [Edit Mode Behaviour](#edit-mode-behaviour)
13. [Common Recipes & Examples](#common-recipes--examples)

---

## How the Plugin Works

The plugin is a self-initialising ES6 class. On page load the IIFE at the bottom of `plugin.js` queries the DOM for every element carrying `data-sdl-plugin="accordions"` and instantiates one `sdlAccordions` object per element.

```
DOM ready
  └─ querySelectorAll('[data-sdl-plugin="accordions"]')
       └─ new sdlAccordions(el)  ← one instance per container
            ├─ reads data-* attributes → merges into settings
            ├─ detects installation method (source | elements)
            ├─ fetches collection data (source mode) OR maps buttons (elements mode)
            ├─ buildAccordions()  → renders <ul> / <li> / <button> DOM
            └─ handleDOMReady()
                 ├─ reloads Squarespace lifecycle (blocks, embeds, plugins)
                 ├─ handles hash navigation
                 └─ emits `sdlAccordions:ready`
```

Settings are resolved by a three-way deep merge (lowest → highest priority):

```
defaultSettings  ←  window.sdlAccordionsSettings  ←  data-* attributes on the element
```

---

## Installation Methods

### Method 1 — Source (Collection-Driven)

The plugin fetches content from a **Squarespace collection** (Blog, Portfolio, Products, etc.) and turns each item into an accordion panel. The item title becomes the accordion header and the item body/content becomes the panel content.

**Minimal HTML (placed in a Code Block):**

```html
<div data-sdl-plugin="accordions" data-source="/faq-collection"></div>
```

- `data-source` must be the URL slug of a Squarespace collection.
- Content is fetched asynchronously via `sdl$.collectionData()`.
- Supports `data-accordion-limit` to cap how many items are rendered.
- Compatible with **Weglot** multi-language setups via `weglotPaths`.

---

### Method 2 — Elements (Section-Driven)

Buttons placed inside the plugin container map to the **next sibling Squarespace section**, pulling its full DOM into the accordion panel. Alternatively, any CSS selector can be targeted via `data-target`.

**Minimal HTML:**

```html
<div data-sdl-plugin="accordions">
  <button>Panel One</button>
  <button>Panel Two</button>
</div>
```

- Without `data-target`: each `<button>` captures the next `<section>` sibling in the page DOM.
- With `data-target`: `data-target=".my-section, #another-section"` accepts a comma-separated list of CSS selectors. Multiple matched elements are all appended into that panel.
- Sections are **moved** (not cloned) into the accordion — preserving all Squarespace blocks, galleries, videos, and embeds.

---

## All Features

### Content & Data

| Feature | Description |
|---|---|
| Collection source | Populate from any Squarespace collection via URL slug |
| Element source | Wrap existing page sections into accordion panels |
| Accordion limit | Cap the number of rendered items (`data-accordion-limit`) |
| Title descriptions | Show an SEO description (or custom CSS `content:` string) as a subtitle below each accordion title |
| Weglot support | Multi-language path rewriting for collection fetches |

### Behaviour

| Feature | Description |
|---|---|
| Single open (default) | Opening one panel closes all others |
| Multiple open | Allow multiple panels open simultaneously (`data-allow-multiple-open="true"`) |
| Initially open | Configure which item(s) are open on load: `"first"`, `"all"`, a 1-based number, or a specific item ID |
| Toggle | Clicking an open panel closes it |
| Animation guard | An `isItemAnimating` flag prevents interaction during open/close transitions |
| Scroll to content | After opening, if the content is off-screen the plugin scrolls it into view |
| Full-width mode | When the container spans the full viewport width it switches to site-max-width-constrained layout |

### Icons

| Feature | Description |
|---|---|
| Plus icon (default) | Two perpendicular lines; vertical rotates to 0° when open |
| Arrow icon | Chevron/arrow rotates 180° when open |
| Custom icon | Any HTML/SVG string; rotation angle configurable via `--sdl-accordion-custom-icon-rotation` |
| Icon placement | Left or right of the title text |
| Icon size | Controlled via `--sdl-accordion-icon-size` |
| Icon colour | Controlled via `--sdl-accordion-icon-color` |
| Icon thickness | Controlled via `--sdl-accordion-icon-thickness` |

### Dividers

| Feature | Description |
|---|---|
| Dividers enabled/disabled | Toggle between-item divider lines |
| Show first divider | Toggle the divider above the first item |
| Show last divider | Toggle the divider below the last item |
| Divider colour, height, opacity | Fully customisable via CSS variables |

### Layout & Alignment

| Feature | Description |
|---|---|
| Title alignment | `left`, `center`, or `right` |
| Icon placement | `left` or `right` |
| Description placement | `left`, `center`, or `right` for panel content |
| Description text alignment | `left`, `center`, or `right` |
| Item spacing | Gap between accordion items via `--sdl-accordion-item-space-between` |
| Item border | Width, style, colour, and radius on each item card |
| Full-width span | Expands to full viewport with site-max-width inner constraint |

### Navigation & URL

| Feature | Description |
|---|---|
| Hash navigation | Opening `page.html#accordion-item-id` opens and scrolls to that panel |
| URL update on open | When `data-update-url="true"` the URL hash is updated when a panel opens |
| Programmatic hash guard | Prevents double-firing when the plugin itself changes the hash |

### Squarespace Integration

| Feature | Description |
|---|---|
| Squarespace lifecycle reload | Re-runs Squarespace's block/embed initialisation after accordion is built |
| Code block initialisation | Re-initialises code blocks inside accordion panels |
| Embed block initialisation | Re-initialises embed blocks inside accordion panels |
| Third-party plugin support | Re-initialises nested SDL or third-party plugins inside panels |
| Color theme handling | Ensures correct color themes are applied to moved sections |
| Product detail injection | `appendAfterBuild` setting places the accordion inside product detail pages automatically |
| Continuity workaround | Special handling for `.ProductItem-details-checkout` |
| Resize listener | Re-evaluates full-width state on window resize |
| Section divider suppression | CSS removes Squarespace section dividers/clip-paths that would break inside accordion panels |
| Portfolio pagination removal | CSS hides `#itemPagination` inside accordion panels |
| Recursive detection | Prevents infinite loops if an accordion source points to itself |
| Edit mode deconstruction | When Squarespace edit mode is entered the accordion HTML is cleared so sections are editable again |

### Accessibility

| Feature | Description |
|---|---|
| ARIA roles | Each title uses `role="heading"` with configurable `aria-level` |
| `aria-expanded` | Updated on every open/close |
| `aria-controls` / `aria-labelledby` | Panel and button are programmatically linked |
| `aria-hidden` on icons | Icons and dividers are hidden from screen readers |
| `prefers-reduced-motion` | All CSS transitions are disabled when reduced motion is preferred |

---

## Configuration Reference

Settings can be applied at three levels:

1. **Global defaults** — edit `sdlAccordions.defaultSettings` in `plugin.js`
2. **Page-level override** — define `window.sdlAccordionsSettings = { ... }` before the plugin loads
3. **Per-instance** — add `data-*` attributes to the container element (highest priority)

For nested keys, use double-underscore notation in data attributes:  
`data-breakpoints__767__navigation-type="accordion"`

### Full Settings Table

| Setting (JS key) | Data attribute | Type | Default | Description |
|---|---|---|---|---|
| `source` | `data-source` | `string` | — | URL slug of collection to fetch |
| `accordionLimit` | `data-accordion-limit` | `number \| false` | `false` | Max number of items to render |
| `allowMultipleOpen` | `data-allow-multiple-open` | `boolean` | `false` | Allow multiple panels open at once |
| `initialOpen` | `data-initial-open` | `"first" \| "all" \| number \| string` | `false` | Which item to open on load |
| `titleDescriptions` | `data-title-descriptions` | `boolean` | `false` | Show description below title text |
| `iconStyle` | `data-icon-style` | `"plus" \| "arrow" \| custom | `"plus"` | Icon type |
| `iconPlacement` | `data-icon-placement` | `"left" \| "right"` | `"right"` | Side of title for icon |
| `titleAlignment` | `data-accordion-title-alignment` | `"left" \| "center" \| "right"` | `"left"` | Title text alignment |
| `titleTag` | `data-title-tag` | `string` | `"h4"` | HTML heading tag wrapping button |
| `dividersEnabled` | `data-dividers-enabled` | `boolean` | `true` | Show divider lines |
| `dividersShowFirst` | `data-dividers-show-first` | `boolean` | `true` | Show divider above first item |
| `dividersShowLast` | `data-dividers-show-last` | `boolean` | `true` | Show divider below last item |
| `scrollToOpenContent` | `data-scroll-to-open-content` | `boolean` | `true` | Scroll panel into view after opening |
| `updateUrl` | `data-update-url` | `boolean` | `false` | Update URL hash when opening a panel |
| `appendAfterBuild` | `data-append-after-build` | `string` (CSS selector) | — | Move accordion into a target element after build |
| `isFullWidth` | `data-is-full-width` (auto-set) | `boolean` | auto | Full-viewport-width layout mode |
| `weglotPaths` | `data-weglot-paths` | `object` | — | Language path map for Weglot |

---

## CSS Custom Properties (Styling API)

All visual aspects are controlled through CSS custom properties. Set them on the container element, on a parent section, or in your Squarespace Custom CSS.

### Item Container

| Property | Default | Description |
|---|---|---|
| `--sdl-accordion-item-border-width` | `0px` | Border width around each item |
| `--sdl-accordion-item-border-style` | `solid` | Border style |
| `--sdl-accordion-item-border-color` | `currentColor` | Border colour |
| `--sdl-accordion-item-border-radius` | `0px` | Corner rounding |
| `--sdl-accordion-item-space-between` | `0px` | Gap between items |

### Dividers

| Property | Default | Description |
|---|---|---|
| `--sdl-accordion-divider-color` | `currentColor` | Divider line colour |
| `--sdl-accordion-divider-height` | `1px` | Divider thickness |
| `--sdl-accordion-divider-opacity` | `1` | Divider opacity |

### Title

| Property | Default | Description |
|---|---|---|
| `--sdl-accordion-title-background` | `transparent` | Title row background |
| `--sdl-accordion-title-opacity` | `1` | Title opacity (0.7 on hover) |
| `--sdl-accordion-title-color` | heading color vars | Title text colour |
| `--sdl-accordion-title-font-family` | heading font | Font family |
| `--sdl-accordion-title-font-style` | heading font | Font style |
| `--sdl-accordion-title-font-weight` | heading font | Font weight |
| `--sdl-accordion-title-line-height` | heading font | Line height |
| `--sdl-accordion-title-letter-spacing` | heading font | Letter spacing |
| `--sdl-accordion-title-text-transform` | heading font | Text transform |
| `--sdl-accordion-title-padding-top` | `14px` | Top padding on click target |
| `--sdl-accordion-title-padding-bottom` | `14px` | Bottom padding on click target |
| `--sdl-accordion-title-padding-left` | `0px` | Left padding |
| `--sdl-accordion-title-padding-right` | `0px` | Right padding |

### Title Descriptions

| Property | Default | Description |
|---|---|---|
| `--sdl-accordion-description` | `""` | Per-item description text (CSS `content:` string) |
| `--sdl-accordion-description-font-size` | `0.9rem` | Description font size |
| `--sdl-accordion-description-color` | `#333` | Description text colour |
| `--sdl-accordion-description-font-family` | body font | Font family |
| `--sdl-accordion-description-font-style` | body font | Font style |
| `--sdl-accordion-description-font-weight` | body font | Font weight |
| `--sdl-accordion-description-line-height` | body font | Line height |
| `--sdl-accordion-description-letter-spacing` | body font | Letter spacing |
| `--sdl-accordion-description-text-transform` | body font | Text transform |

### Icons

| Property | Default | Description |
|---|---|---|
| `--sdl-accordion-icon-size` | `14px` | Icon container size (width & height) |
| `--sdl-accordion-icon-color` | `currentColor` | Icon colour |
| `--sdl-accordion-icon-thickness` | `1px` | Line/arrow border thickness |
| `--sdl-accordion-custom-icon-rotation` | `180deg` | Rotation applied to custom icon when open |

---

## JavaScript Events API

The plugin emits custom events via `sdl$.emitEvent()` at key lifecycle points. Listen for them on `window` or `document` using `addEventListener`.

| Event name | When fired | Detail payload |
|---|---|---|
| `sdlAccordions:beforeInit` | Before the plugin initialises | — |
| `sdlAccordions:ready` | After full build and Squarespace lifecycle reload | — |
| `sdlAccordions:beforeOpen` | Before a panel opens | `{ accordionId, accordion }` |
| `sdlAccordions:afterOpen` | After open animation completes | `{ accordionId, accordion }` |
| `sdlAccordions:beforeClose` | Before a panel closes | `{ accordionId, accordion }` |
| `sdlAccordions:afterClose` | After close animation completes | `{ accordionId, accordion }` |

**Example — scroll a third-party sticky nav offset on open:**

```js
document.addEventListener('sdlAccordions:afterOpen', (e) => {
  const { accordionId } = e.detail;
  console.log(`Panel "${accordionId}" is now open`);
});
```

---

## URL & Hash Navigation

Each accordion item is assigned a URL-friendly ID derived from its title:

```
"Shipping & Returns" → data-accordion-id="shipping-returns"
```

Duplicate IDs are automatically de-duplicated by appending `-1`, `-2`, etc.

### Deep-link to an accordion on page load

```
https://yoursite.com/faq#shipping-returns
```

The plugin will open that panel and smooth-scroll to it after a 400 ms delay to allow the animation.

### Update URL on open

```html
<div data-sdl-plugin="accordions" data-source="/faq" data-update-url="true">
```

Every time a user opens a panel the URL hash updates, enabling back/forward navigation and shareable links.

---

## Squarespace Integration Details

### Why the Plugin Reloads the Squarespace Lifecycle

When sections are moved into accordion panels the Squarespace JavaScript that initialises galleries, video players, commerce blocks, and embeds has already run. The plugin calls `sdl$.reloadSquarespaceLifecycle()` to re-run this initialisation on the new DOM position.

### Product Detail Injection

To embed the accordion inside a Product Detail page (below the add-to-cart button):

```html
<div
  data-sdl-plugin="accordions"
  data-source="/product-faqs"
  data-append-after-build=".ProductItem-details-checkout"
></div>
```

The plugin automatically includes `.product-detail .product-meta` as a fallback selector for older Squarespace templates.

### Section Divider Suppression

Squarespace adds decorative section dividers via CSS `clip-path`. When sections live inside an accordion these break the layout. The plugin's CSS overrides `clip-path: unset`, `z-index: initial`, and hides `.section-divider-display` elements automatically.

### Edit Mode

When a visitor switches to Squarespace edit mode (the page editor), the plugin detects the `sqs-is-page-editing` class on `<body>` using a `MutationObserver`, clears the accordion HTML, and reloads the Squarespace lifecycle — restoring all sections to their original editable positions.

---

## Adding the Plugin to Squarespace

### Step 1 — Upload the Files

1. Go to **Settings → Advanced → Code Injection** (or use a Developer mode `site.region` file).
2. Add the CSS in the **CSS** box (or inside `<style>` tags in the footer):

```html
<style>
  /* Paste full contents of plugin.css here */
</style>
```

3. Add the JS just before `</body>` (or in **Footer Code Injection**):

```html
<script>
  /* Paste full contents of plugin.js here */
</script>
```

> For production use, host the files on a CDN and load them via `<link>` / `<script src>` tags instead.

---

### Step 2 — Add a Code Block to Your Page

Drag a **Code Block** onto your page where you want the accordion to appear. Paste your configuration HTML. Minimum required markup:

**Collection-driven accordion:**

```html
<div
  data-sdl-plugin="accordions"
  data-source="/your-collection-slug"
></div>
```

**Section/element-driven accordion:**

```html
<div data-sdl-plugin="accordions">
  <button>Section One Title</button>
  <button>Section Two Title</button>
</div>
```

For the element method, arrange the target `<section>` blocks **directly after** the Code Block on the page (or use `data-target` selectors).

---

### Step 3 — Configure with Data Attributes

Apply any combination of settings as `data-*` attributes:

```html
<div
  data-sdl-plugin="accordions"
  data-source="/faq"
  data-accordion-limit="10"
  data-allow-multiple-open="false"
  data-initial-open="first"
  data-icon-style="arrow"
  data-icon-placement="right"
  data-accordion-title-alignment="left"
  data-update-url="true"
  data-dividers-enabled="true"
  data-dividers-show-first="true"
  data-dividers-show-last="false"
  data-scroll-to-open-content="true"
></div>
```

---

### Step 4 — Style with CSS Custom Properties

Add your design tokens in **Design → Custom CSS** or inside a `<style>` block:

```css
/* Target all accordion instances */
[data-sdl-plugin="accordions"] {
  --sdl-accordion-title-padding-top: 20px;
  --sdl-accordion-title-padding-bottom: 20px;
  --sdl-accordion-title-padding-left: 16px;
  --sdl-accordion-title-padding-right: 16px;
  --sdl-accordion-divider-color: #e0e0e0;
  --sdl-accordion-divider-height: 1px;
  --sdl-accordion-icon-size: 18px;
  --sdl-accordion-icon-color: #333;
  --sdl-accordion-item-border-width: 1px;
  --sdl-accordion-item-border-radius: 8px;
  --sdl-accordion-item-space-between: 8px;
}
```

---

### Step 5 (Optional) — Global JS Settings

Set global overrides before the plugin script loads:

```html
<script>
  window.sdlAccordionsSettings = {
    allowMultipleOpen: false,
    initialOpen: "first",
    iconStyle: "arrow",
    scrollToOpenContent: true,
    titleDescriptions: true,
  };
</script>
```

---

## Advanced Usage Patterns

### Accordion in a Product Page

```html
<div
  data-sdl-plugin="accordions"
  data-source="/product-faqs"
  data-append-after-build=".ProductItem-details-checkout"
  data-icon-style="plus"
></div>
```

### Custom Icon (SVG)

```html
<div data-sdl-plugin="accordions" data-source="/faq" data-icon-style="custom">
</div>
<script>
  window.sdlAccordionsSettings = {
    icons: {
      custom: '<svg width="14" height="14" viewBox="0 0 14 14"><path d="M7 0v14M0 7h14" stroke="currentColor"/></svg>'
    }
  };
</script>
<style>
  [data-sdl-plugin="accordions"] {
    --sdl-accordion-custom-icon-rotation: 45deg;
  }
</style>
```

### Targeting Specific Sections by Selector

```html
<div data-sdl-plugin="accordions">
  <button data-target="#section-shipping">Shipping</button>
  <button data-target="#section-returns, #section-exchanges">Returns & Exchanges</button>
</div>
```

### Per-item Description via CSS

Enable `data-title-descriptions="true"` then set descriptions in Custom CSS per item ID:

```css
[data-accordion-id="shipping-returns"] {
  --sdl-accordion-description: "Everything about getting your order";
}
[data-accordion-id="contact-us"] {
  --sdl-accordion-description: "Reach the team directly";
}
```

### Listening for Open/Close Events

```js
document.addEventListener('sdlAccordions:afterOpen', ({ detail }) => {
  // Trigger analytics
  gtag('event', 'accordion_open', { accordion_id: detail.accordionId });
});
```

### Programmatically Open a Panel

```js
// After the plugin is ready, call openAccordion on the instance
document.addEventListener('sdlAccordions:ready', () => {
  const el = document.querySelector('[data-sdl-plugin="accordions"]');
  if (el?.sdlAccordions) {
    el.sdlAccordions.openAccordion('my-panel-id');
  }
});
```

---

## Accessibility

The plugin follows WAI-ARIA accordion pattern:

- Each title row is wrapped in a heading element (`<h4>` by default, configurable via `data-title-tag`).
- The heading contains a `<button>` with `aria-controls` pointing to the panel `id`.
- The panel `<div>` carries `role="region"` and `aria-labelledby` pointing back to the button `id`.
- `aria-expanded` is toggled `true`/`false` on every interaction.
- Icons and decorative dividers use `aria-hidden="true"`.
- All CSS transitions are removed when `prefers-reduced-motion: reduce` is detected.

---

## Edit Mode Behaviour

The plugin uses a `MutationObserver` to watch the `<body>` class list for `sqs-is-page-editing`. When that class appears:

1. All accordion container elements have their `innerHTML` cleared.
2. `sdl$.reloadSquarespaceLifecycle()` is called — returning all originally wrapped sections to their editable positions.
3. The observer disconnects to avoid repeated processing.

The Code Block itself shows a dashed border and centred label **"Accordions Plugin Settings"** on hover in edit mode (via the CSS edit mode rules).

---

## Common Recipes & Examples

### Minimal FAQ (collection, no borders)

```html
<div
  data-sdl-plugin="accordions"
  data-source="/faq"
  data-initial-open="first"
></div>
```

### Card-style FAQ (bordered items, rounded)

```html
<div
  data-sdl-plugin="accordions"
  data-source="/faq"
  data-icon-style="arrow"
>
</div>
```

```css
[data-sdl-plugin="accordions"] {
  --sdl-accordion-item-border-width: 1px;
  --sdl-accordion-item-border-radius: 12px;
  --sdl-accordion-item-space-between: 12px;
  --sdl-accordion-title-padding-left: 20px;
  --sdl-accordion-title-padding-right: 20px;
  --sdl-accordion-divider-height: 0px;
}
```

### Full-width section accordion (wrapping whole page sections)

```html
<div data-sdl-plugin="accordions">
  <button>About Us</button>
  <button>Our Work</button>
  <button>Contact</button>
</div>
<!-- The three sections immediately following this Code Block are used as content -->
```

### Multiple open, all expanded by default

```html
<div
  data-sdl-plugin="accordions"
  data-source="/docs"
  data-allow-multiple-open="true"
  data-initial-open="all"
></div>
```
