(function () {
  /*
    SDL Accordion Pro v1.0
    A sophisticated, configurable accordion plugin for Squarespace.
    - Two installation methods: Source (collection-driven) & Elements (section-driven)
    - Single / multiple open, initial open, hash navigation, URL updating
    - Plus / Arrow / Custom icons, dividers, full CSS custom-property styling API
    - Self-contained: no external helper library required (no constructor / class)

    Markup:
      <div data-sdl-plugin="accordions" data-source="/faq"></div>
      — or —
      <div data-sdl-plugin="accordions">
        <button>Panel One</button>
        <button>Panel Two</button>
      </div>

    Page-level overrides: define window.sdlAccordionsSettings = { ... } before this script.
  */

  "use strict";

  const PLUGIN_TITLE = "sdlAccordions";
  const PLUGIN_SELECTOR = '[data-sdl-plugin="accordions"]';

  const DEFAULT_SETTINGS = {
    source: undefined,
    accordionLimit: false,
    allowMultipleOpen: false,
    initialOpen: false,
    titleDescriptions: false,
    iconStyle: "plus",
    icons: {
      plus: '<div class="plus"><div class="plus__horizontal-line"></div><div class="plus__vertical-line"></div></div>',
      arrow: '<div class="arrow-container"><div class="arrow"></div></div>',
    },
    containerClass: "accordion-items-container",
    itemClass: "accordion-item",
    titleTag: "h4",
    titleWrapperClass: "accordion-item__title-wrapper",
    titleButtonClass: "accordion-item__click-target",
    titleTextClass: "accordion-item__title",
    titleDescriptionClass: "accordion-item__title-description",
    iconContainerClass: "accordion-icon-container",
    contentDropdownClass: "accordion-item__dropdown",
    contentDescriptionClass: "accordion-item__description",
    dividersEnabled: true,
    dividersShowFirst: true,
    dividersShowLast: true,
    dividersClass: "accordion-divider",
    dividersTopClass: "accordion-divider--top",
    titleAlignment: "left",
    iconPlacement: "right",
    scrollToOpenContent: true,
    updateUrl: false,
    appendAfterBuild: undefined,
    isFullWidth: false,
    weglotPaths: undefined,
  };

  /* ------------------------------------------------------------------ *
   *  Shared utilities (replace the internal sdl$ helper library)
   * ------------------------------------------------------------------ */

  function isPlainObject(value) {
    return (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      Object.prototype.toString.call(value) === "[object Object]"
    );
  }

  function deepMerge(target, ...sources) {
    sources.forEach((source) => {
      if (!isPlainObject(source)) return;
      Object.keys(source).forEach((key) => {
        const sourceVal = source[key];
        if (isPlainObject(sourceVal)) {
          if (!isPlainObject(target[key])) target[key] = {};
          deepMerge(target[key], sourceVal);
        } else if (sourceVal !== undefined) {
          target[key] = sourceVal;
        }
      });
    });
    return target;
  }

  // Convert a data-* string value into a real JS type (bool / number / JSON).
  function parseAttr(value) {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    if (trimmed === "true") return true;
    if (trimmed === "false") return false;
    if (trimmed === "null") return null;
    if (trimmed !== "" && !isNaN(Number(trimmed)) && /^-?\d*\.?\d+$/.test(trimmed)) {
      return Number(trimmed);
    }
    if (
      (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
      (trimmed.startsWith("[") && trimmed.endsWith("]"))
    ) {
      try {
        return JSON.parse(trimmed);
      } catch (e) {
        return value;
      }
    }
    return value;
  }

  function emitEvent(name, detail) {
    try {
      window.dispatchEvent(
        new CustomEvent(name, { detail: detail || null, bubbles: true })
      );
    } catch (e) {
      /* no-op */
    }
  }

  // Resolve a scope argument (node / array / nothing) into real DOM nodes.
  function resolveNodes(scope) {
    if (!scope) return [document.body];
    const arr = Array.isArray(scope) ? scope : [scope];
    return arr.filter((n) => n && n.nodeType === 1);
  }

  // Trigger Squarespace's responsive ImageLoader for lazy/unloaded images.
  function loadImages(scope) {
    const imageLoader = window.ImageLoader || window.Squarespace?.ImageLoader;
    if (!imageLoader || typeof imageLoader.load !== "function") return;
    resolveNodes(scope).forEach((node) => {
      node.querySelectorAll("img[data-src], img:not([src])").forEach((img) => {
        try { imageLoader.load(img, { load: true }); } catch (e) { /* no-op */ }
        img.classList.add("loaded");
      });
    });
  }

  // Re-execute <script> tags inside injected markup. DOMParser never runs
  // scripts, so embed blocks, custom code, and third-party SDKs stay silent
  // until this runs. Executes sequentially; idempotent via data-sdl-ran.
  function executeScripts(container) {
    if (!container) return Promise.resolve();
    const scripts = Array.from(
      container.querySelectorAll("script:not([data-sdl-ran])")
    ).filter((s) => {
      const t = s.getAttribute("type");
      return !t || t === "text/javascript" || t === "application/javascript";
    });
    return scripts.reduce(
      (chain, old) =>
        chain.then(
          () =>
            new Promise((resolve) => {
              const script = document.createElement("script");
              Array.from(old.attributes).forEach((a) => script.setAttribute(a.name, a.value));
              script.setAttribute("data-sdl-ran", "");
              if (old.src) {
                let done = false;
                const finish = () => { if (!done) { done = true; resolve(); } };
                script.onload = script.onerror = finish;
                setTimeout(finish, 5000); // guard: never stall on a blocked src
                script.src = old.src;
                old.parentNode.replaceChild(script, old);
              } else {
                script.textContent = old.textContent || "";
                old.parentNode.replaceChild(script, old);
                resolve();
              }
            })
        ),
      Promise.resolve()
    );
  }

  // Hydrate Squarespace form blocks in injected content. Must run after
  // content is in its final DOM position. Covers both 7.1 React forms and
  // legacy YUI forms.
  function reinitializeForms(scope) {
    const nodes = resolveNodes(scope);
    const Y = window.Y;
    const Sqs = window.Squarespace;
    if (!Y || !Sqs) return;
    nodes.forEach((node) => {
      const hasComponentForm = node.querySelector(
        '[data-definition-name="website.components.form"], .sqs-block-website-component'
      );
      const hasLegacyForm = node.querySelector(
        ".sqs-block-form, .form-block, .sqs-block-newsletter, .newsletter-block"
      );
      if (!hasComponentForm && !hasLegacyForm) return;
      try { if (typeof Sqs.initializeWebsiteComponent === "function") Sqs.initializeWebsiteComponent(Y); } catch (e) {}
      try { if (typeof Sqs.initializeFormBlocks === "function") Sqs.initializeFormBlocks(Y, Y); } catch (e) {}
    });
  }

  // Render Squarespace video embed blocks from their data-html attribute.
  // 7.1 video blocks are React components whose visitor module fails to load
  // in AJAX-injected content. This builds the iframe from the server-rendered
  // data-html and strips the hydration marker to suppress the console error.
  function renderVideoEmbeds(scope) {
    resolveNodes(scope).forEach((node) => {
      node.querySelectorAll(".sqs-video-wrapper[data-html]").forEach((wrap) => {
        const component = wrap.closest("[data-website-component-id]");
        if (component) component.removeAttribute("data-website-component-id");
        if (wrap.querySelector("iframe")) return;
        const html = wrap.getAttribute("data-html");
        if (!html) return;
        const tmp = document.createElement("div");
        tmp.innerHTML = html;
        const iframe = tmp.querySelector("iframe");
        if (iframe) wrap.appendChild(iframe);
      });
    });
  }

  // Stale-while-revalidate localStorage cache for collection JSON fetches.
  // Returns cached data immediately (even if stale) and refreshes in the
  // background, so repeat accordion opens feel instant.
  const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
  function fetchWithCache(url) {
    const cacheKey = "sdlAccordions:cache:" + url;
    let stored = null;
    try {
      const raw = localStorage.getItem(cacheKey);
      if (raw) stored = JSON.parse(raw);
    } catch (e) { /* localStorage unavailable */ }

    const doFetch = () =>
      fetch(url, { credentials: "same-origin" })
        .then((res) => {
          if (!res.ok) throw new Error("sdlAccordions: HTTP " + res.status + " fetching " + url);
          return res.json();
        })
        .then((data) => {
          try {
            localStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data }));
          } catch (e) { /* storage full or unavailable */ }
          return data;
        });

    if (!stored) return doFetch();
    const isStale = Date.now() - stored.timestamp > CACHE_TTL_MS;
    if (isStale) doFetch().catch(() => {}); // background refresh
    return Promise.resolve(stored.data);
  }

  // Backfill data-section-theme on injected sections that lack it, so fetched
  // sections keep their colour themes when moved into the live document.
  function handleAddingMissingColorTheme() {
    try {
      document.querySelectorAll(".page-section:not([data-section-theme])").forEach((section) => {
        const themed = section.closest("[data-section-theme]");
        if (themed) section.dataset.sectionTheme = themed.dataset.sectionTheme;
      });
    } catch (e) { /* no-op */ }
  }

  // Extract the page-section markup from an individual collection item's HTML
  // page. Squarespace 7.1 item pages render their sections inside an <article>
  // (or #sections / <main>). Returns a "<div id='sections'>…</div>" string.
  function extractSectionsFromPageHtml(html) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const container =
      doc.querySelector("article #sections") ||
      doc.querySelector("#sections") ||
      doc.querySelector("article") ||
      doc.querySelector("main") ||
      doc.body;
    if (!container) return "";

    let sections = container.querySelectorAll(
      ":scope > section.page-section, :scope > section[data-section-id]"
    );
    if (!sections.length) {
      sections = container.querySelectorAll(
        "section.page-section, section[data-section-id]"
      );
    }

    const wrap = document.createElement("div");
    wrap.id = "sections";
    if (sections.length) {
      sections.forEach((section) => wrap.appendChild(section));
    } else {
      wrap.innerHTML = container.innerHTML;
    }
    return wrap.outerHTML;
  }

  // Fetch a single item page and return its sections markup (best-effort).
  async function fetchItemSections(fullUrl) {
    try {
      const res = await fetch(fullUrl, {
        credentials: "same-origin",
        headers: { Accept: "text/html" },
      });
      if (!res.ok) {
        console.error(
          "sdlAccordions: failed to fetch item page " + fullUrl + " (HTTP " + res.status + ")"
        );
        return "";
      }
      const html = await res.text();
      return extractSectionsFromPageHtml(html);
    } catch (e) {
      console.error("sdlAccordions: error fetching item page " + fullUrl, e);
      return "";
    }
  }

  // Fetch a Squarespace collection as JSON and normalise its items. For a
  // portfolio (a collection of pages), the list JSON does NOT embed each item's
  // page sections, so we fetch each item's page and pull the sections from its
  // <article>. Blog / FAQ / other collections keep their inline item.body.
  async function collectionData(source, options) {
    const opts = options || {};
    let path = source;

    // Weglot multi-language path rewriting.
    if (opts.weglotPaths && typeof opts.weglotPaths === "object") {
      const lang =
        document.documentElement.getAttribute("lang") ||
        (window.Weglot && window.Weglot.getCurrentLang && window.Weglot.getCurrentLang());
      if (lang && opts.weglotPaths[lang]) path = opts.weglotPaths[lang];
    }

    if (!/^https?:\/\//.test(path) && path[0] !== "/") path = "/" + path;
    const url = path + (path.indexOf("?") === -1 ? "?format=json" : "&format=json");

    const data = await fetchWithCache(url);
    const rawItems = Array.isArray(data.items) ? data.items : [];

    const items = rawItems.map((item) => ({
      id: item.id,
      title: item.title || "",
      body: item.body || item.excerpt || "",
      fullUrl: item.fullUrl,
      seoData: item.seoData || {
        seoDescription: item.seoData?.seoDescription || item.excerpt || "",
      },
    }));

    const type = data.collection?.typeName || data.collection?.type || "collection";
    // Portfolio collections report typeName like "portfolio", "portfolio-grid-basic", etc.
    const isPortfolio = /portfolio/i.test(String(type));

    // Portfolio items are full pages whose sections are NOT in the list JSON,
    // so fetch each item's page and pull its sections. Non-portfolio
    // collections (blog / FAQ / events) keep their inline body; only an item
    // with an empty body but a fullUrl falls back to a page fetch.
    await Promise.all(
      items.map(async (it, i) => {
        const rawBody = (rawItems[i] && rawItems[i].body) || "";
        const rawHasSections = rawBody.indexOf('id="sections"') !== -1;
        if (it.fullUrl && !rawHasSections && (isPortfolio || !rawBody.trim())) {
          const sections = await fetchItemSections(it.fullUrl);
          if (sections) it.body = sections;
        }
      })
    );

    return { items, type };
  }

  /* ------------------------------------------------------------------ *
   *  Lazy content + gallery layout (for fetched page sections)
   * ------------------------------------------------------------------ */

  // Force lazy / JS-gated content visible inside injected markup: responsive
  // images (data-src + ImageLoader), gallery items hidden by
  // ".gallery-*-item:not([data-show])", and section background images.
  function revealLazyContent(scope) {
    resolveNodes(scope).forEach((node) => {
      try {
        node.querySelectorAll("img[data-src]").forEach((img) => {
          if (window.ImageLoader && typeof window.ImageLoader.load === "function") {
            try {
              window.ImageLoader.load(img, { load: true });
            } catch (e) {
              /* fall through */
            }
          }
          if (!img.getAttribute("src")) img.setAttribute("src", img.getAttribute("data-src"));
          img.classList.add("loaded");
          img.setAttribute("data-loaded", "true");
        });
      } catch (e) {
        /* no-op */
      }
      try {
        node
          .querySelectorAll(
            '.gallery-grid-item, .gallery-masonry-item, .gallery-strips-item, ' +
              '.gallery-stacked-item, .gallery-reel-item, .gallery-slideshow-item, ' +
              '.gallery-fullscreen-slideshow-item, .gallery-square-item, ' +
              '[class*="gallery-"][class*="-item"]'
          )
          .forEach((item) => item.setAttribute("data-show", ""));
      } catch (e) {
        /* no-op */
      }
      try {
        node
          .querySelectorAll('[data-loader-loaded="false"]')
          .forEach((el2) => el2.setAttribute("data-loader-loaded", "true"));
      } catch (e) {
        /* no-op */
      }
    });
  }

  // ---- Squarespace 7.1 Gallery Section layout reproduction ----
  // Gallery sections (data-controller="GalleryGrid"/"GalleryMasonry") are laid
  // out by a bundled controller that runs once on initial page load and cannot
  // be re-invoked on injected content. Reproduce its layout from data-props.
  function galleryAspectWH(name) {
    switch (name) {
      case "square": return 1;
      case "portrait": return 2 / 3;
      case "standard": return 4 / 3;
      case "widescreen": return 16 / 9;
      default: return null; // "original" → image's natural ratio
    }
  }

  function galleryItemRatioHW(item) {
    const img = item.querySelector("img");
    const dims = img && img.getAttribute("data-image-dimensions");
    if (dims) {
      const parts = dims.split("x").map(Number);
      if (parts[0] && parts[1]) return parts[1] / parts[0];
    }
    if (img && img.naturalWidth) return img.naturalHeight / img.naturalWidth;
    return 1;
  }

  function readGalleryProps(el) {
    let props = {};
    try {
      props = JSON.parse(el.dataset.props || "{}");
    } catch (e) {
      /* fall back to data-* */
    }
    return {
      numColumns: Number(props.numColumns) || Number(el.dataset.columns) || 1,
      gutter: props.gutter != null ? Number(props.gutter) : Number(el.dataset.gutter) || 0,
      aspectRatio: props.aspectRatio || el.dataset.aspectRatio || "original",
    };
  }

  function responsiveColumns(cols, width) {
    if (width < 480) return 1;
    if (width < 767) return Math.min(cols, 2);
    return cols;
  }

  function layoutGalleryGrid(grid) {
    const wrapper = grid.querySelector(".gallery-grid-wrapper");
    if (!wrapper) return;
    const { numColumns, gutter, aspectRatio } = readGalleryProps(grid);
    const cols = responsiveColumns(numColumns, wrapper.clientWidth || window.innerWidth);
    const gapVw = gutter / 20; // controller maps gutter 50 → 2.5vw
    wrapper.style.gridTemplateColumns = "repeat(" + cols + ", 1fr)";
    wrapper.style.columnGap = gapVw + "vw";
    wrapper.style.rowGap = gapVw + "vw";
    const fixedAr = galleryAspectWH(aspectRatio);
    grid.querySelectorAll(".gallery-grid-item").forEach((item) => {
      item.style.position = "relative";
      const arWH = fixedAr != null ? fixedAr : 1 / galleryItemRatioHW(item);
      item.style.aspectRatio = String(arWH);
    });
  }

  function layoutGalleryMasonry(gallery) {
    const wrapper = gallery.querySelector(".gallery-masonry-wrapper");
    if (!wrapper) return;
    const width = wrapper.clientWidth;
    if (!width) return;
    const { numColumns, gutter } = readGalleryProps(gallery);
    const cols = responsiveColumns(numColumns, width);
    const gutterPx = ((gutter / 20) / 100) * window.innerWidth;
    const colWidth = (width - gutterPx * (cols - 1)) / cols;
    const colHeights = new Array(cols).fill(0);
    wrapper.style.position = "relative";
    gallery.querySelectorAll(".gallery-masonry-item").forEach((item) => {
      const itemHeight = colWidth * galleryItemRatioHW(item);
      let min = 0;
      for (let i = 1; i < cols; i++) {
        if (colHeights[i] < colHeights[min]) min = i;
      }
      item.style.position = "absolute";
      item.style.margin = "0";
      item.style.width = colWidth + "px";
      item.style.left = min * (colWidth + gutterPx) + "px";
      item.style.top = colHeights[min] + "px";
      colHeights[min] += itemHeight + gutterPx;
    });
    const tallest = colHeights.reduce((a, b) => Math.max(a, b), 0);
    wrapper.style.height = Math.max(0, tallest - gutterPx) + "px";
  }

  function layoutGalleries(scope) {
    resolveNodes(scope).forEach((node) => {
      try {
        node.querySelectorAll(".gallery-grid").forEach(layoutGalleryGrid);
      } catch (e) {
        /* no-op */
      }
      try {
        node.querySelectorAll(".gallery-masonry").forEach(layoutGalleryMasonry);
      } catch (e) {
        /* no-op */
      }
    });
  }

  // Re-run Squarespace's block / embed / commerce initialisation after the
  // accordion DOM has been (re)built and content injected, then force any lazy
  // content visible and reproduce gallery layout. `scope` limits the work.
  async function reloadSquarespaceLifecycle(scope) {
    const nodes = resolveNodes(scope);
    try {
      const Y = window.Y;
      const SQS = window.Squarespace;
      if (SQS && Y) {
        if (typeof SQS.globalInit === "function") SQS.globalInit(Y);
        nodes.forEach((node) => {
          const yNode = Y.one(node);
          if (!yNode) return;
          if (typeof SQS.initializeLayoutBlocks === "function") SQS.initializeLayoutBlocks(Y, yNode);
          if (typeof SQS.initializeNativeVideo === "function") SQS.initializeNativeVideo(Y, yNode);
          if (typeof SQS.initializeSummaryV2Block === "function") SQS.initializeSummaryV2Block(Y, yNode);
          if (typeof SQS.initializeCommentLink === "function") SQS.initializeCommentLink(Y, yNode);
          if (typeof SQS.initializeParallax === "function") SQS.initializeParallax(Y, yNode);
          if (typeof SQS.initializeCommerce === "function") SQS.initializeCommerce(Y, yNode);
        });
        if (typeof SQS.afterBodyLoad === "function") SQS.afterBodyLoad(Y);
      }
    } catch (e) {
      /* best-effort — never break the page */
    }

    revealLazyContent(nodes);
    loadImages(nodes);
    layoutGalleries(nodes);

    window.dispatchEvent(new Event("resize"));
    window.dispatchEvent(new Event("mercury:load"));
  }

  /* ------------------------------------------------------------------ *
   *  Edit-mode handling (shared across all instances, attached once)
   * ------------------------------------------------------------------ */

  let editModeObserverSet = false;
  let hasDeconstructedForEditMode = false;

  function addEditModeObserver() {
    const isBackend = window.self !== window.top;
    if (editModeObserverSet || !isBackend) return;

    const bodyObserver = new MutationObserver(async (mutations) => {
      for (const mutation of mutations) {
        if (mutation.attributeName !== "class") continue;
        if (!document.body.classList.contains("sqs-is-page-editing")) continue;
        if (hasDeconstructedForEditMode) continue;

        hasDeconstructedForEditMode = true;
        document
          .querySelectorAll(PLUGIN_SELECTOR)
          .forEach((accEl) => (accEl.innerHTML = ""));

        try {
          await reloadSquarespaceLifecycle();
        } catch (error) {
          console.error("sdlAccordions: error reloading lifecycle", error);
        }
        bodyObserver.disconnect();
      }
    });

    bodyObserver.observe(document.body, { attributes: true });
    editModeObserverSet = true;
  }

  /* ------------------------------------------------------------------ *
   *  Instance factory — one accordion per matching element (no class)
   * ------------------------------------------------------------------ */

  function readInstanceSettings(el) {
    const dataAttributes = {};

    if (el.dataset.desktopNavigationType) {
      el.dataset.breakpoints__767__navigationType = el.dataset.desktopNavigationType;
    }
    if (el.dataset.mobileNavigationType) {
      el.dataset.breakpoints__0__navigationType = el.dataset.mobileNavigationType;
    }

    const setNestedProperty = (obj, keyPath, value) => {
      const keys = keyPath.split("__");
      let current = obj;
      keys.forEach((key, index) => {
        if (index === keys.length - 1) {
          current[key] = parseAttr(value);
        } else {
          current = current[key] = current[key] || {};
        }
      });
    };

    for (const [attrName, value] of Object.entries(el.dataset)) {
      // Map the data attribute names onto the setting keys used internally.
      let key = attrName;
      if (key === "accordionTitleAlignment") key = "titleAlignment";
      setNestedProperty(dataAttributes, key, value);
    }
    return dataAttributes;
  }

  function createAccordion(el) {
    // Guard against double-initialisation.
    if (el.dataset.loadingState) return el.sdlAccordions || null;
    el.dataset.loadingState = "loading";

    const source = el.dataset.source;

    // Recursion guard — an accordion whose source points back at itself.
    if (
      source &&
      el.parentElement &&
      el.parentElement.closest(
        `${PLUGIN_SELECTOR}[data-source="${source}"]`
      )
    ) {
      console.error("sdlAccordions: recursive accordions plugin detected");
      return null;
    }

    const userSettings = window[PLUGIN_TITLE + "Settings"] || {};
    const settings = deepMerge(
      {},
      DEFAULT_SETTINGS,
      userSettings,
      readInstanceSettings(el)
    );

    // Per-instance state held in closure (no `this`).
    const instance = {
      el,
      settings,
      source,
      installationMethod: source ? "source" : null,
      accordions: [],
      programmaticHashChangeInProgress: false,
      fullWidthResizeListenerSet: false,
      hashChangeListenerSet: false,
      boundHandleHashNavigation: null,
    };

    /* --- ID helpers ---------------------------------------------------- */

    function turnStringIntoId(string) {
      const baseId = String(string || "")
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, "-")
        .replace(/^-+|-+$/g, "");
      let finalId = baseId || "item";
      let counter = 1;
      while (document.querySelector(`[data-accordion-id="${finalId}"]`)) {
        finalId = `${baseId}-${counter}`;
        counter++;
      }
      return finalId;
    }

    /* --- Full-width detection ----------------------------------------- */

    function setIsFullWidth() {
      const tolerance = 2; // px, for rounding errors
      const elRect = el.getBoundingClientRect();
      const windowWidth = window.innerWidth || document.documentElement.clientWidth;
      if (Math.abs(elRect.width - windowWidth) <= tolerance) {
        el.setAttribute("data-is-full-width", "true");
      } else {
        el.removeAttribute("data-is-full-width");
      }
    }

    /* --- Open / close animation --------------------------------------- */

    function performOpen(itemEl, titleButton, contentDiv, descriptionDiv) {
      if (
        itemEl.dataset.isOpen === "true" ||
        itemEl.dataset.isItemAnimating === "true"
      )
        return;

      emitEvent(`${PLUGIN_TITLE}:beforeOpen`, {
        accordionId: itemEl.dataset.accordionId,
        accordion: instance,
      });

      itemEl.dataset.isItemAnimating = "true";
      contentDiv.style.display = "block";

      // Reveal lazy images and (re)compute Squarespace gallery layout now that
      // the content has width, so scrollHeight includes the gallery height and
      // the open animation expands to the correct size.
      revealLazyContent(descriptionDiv);
      loadImages(descriptionDiv);
      layoutGalleries(descriptionDiv);
      // Video iframes and scripts that failed to initialize while the panel was
      // hidden (max-height:0) get a second chance here. executeScripts is
      // idempotent via data-sdl-ran, so re-calling is safe.
      renderVideoEmbeds(descriptionDiv);
      executeScripts(descriptionDiv).catch(() => {});

      const scrollHeight = descriptionDiv.scrollHeight + "px";

      requestAnimationFrame(() => {
        contentDiv.style.maxHeight = scrollHeight;
      });
      itemEl.dataset.isOpen = "true";
      titleButton.setAttribute("aria-expanded", "true");

      let transitionEnded = false;
      const onTransitionEnd = () => {
        if (transitionEnded) return;
        transitionEnded = true;
        if (itemEl.dataset.isOpen === "true") contentDiv.style.maxHeight = "none";
        delete itemEl.dataset.isItemAnimating;
        contentDiv.removeEventListener("transitionend", onTransitionEnd);

        emitEvent(`${PLUGIN_TITLE}:afterOpen`, {
          accordionId: itemEl.dataset.accordionId,
          accordion: instance,
        });

        if (settings.scrollToOpenContent && itemEl.dataset.isOpen === "true") {
          const contentRect = contentDiv.getBoundingClientRect();
          if (contentRect.top < 0) {
            itemEl.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        }
      };

      contentDiv.addEventListener("transitionend", onTransitionEnd);
      setTimeout(onTransitionEnd, 400); // fallback (reduced motion, display issues)
    }

    function performClose(itemEl, titleButton, contentDiv, descriptionDiv) {
      if (
        itemEl.dataset.isOpen === "false" ||
        itemEl.dataset.isItemAnimating === "true"
      )
        return;

      emitEvent(`${PLUGIN_TITLE}:beforeClose`, {
        accordionId: itemEl.dataset.accordionId,
        accordion: instance,
      });

      itemEl.dataset.isItemAnimating = "true";
      const currentScrollHeight = descriptionDiv.scrollHeight + "px";
      contentDiv.style.maxHeight = currentScrollHeight;

      // Force reflow so the browser registers maxHeight before animating to 0.
      void contentDiv.offsetHeight;

      requestAnimationFrame(() => {
        contentDiv.style.maxHeight = "0px";
      });
      itemEl.dataset.isOpen = "false";
      titleButton.setAttribute("aria-expanded", "false");

      let transitionEnded = false;
      const onTransitionEnd = () => {
        if (transitionEnded) return;
        transitionEnded = true;
        delete itemEl.dataset.isItemAnimating;
        contentDiv.removeEventListener("transitionend", onTransitionEnd);
        emitEvent(`${PLUGIN_TITLE}:afterClose`, {
          accordionId: itemEl.dataset.accordionId,
          accordion: instance,
        });
      };

      contentDiv.addEventListener("transitionend", onTransitionEnd);
      setTimeout(onTransitionEnd, 400);
    }

    function getItemParts(itemEl) {
      const titleButton = itemEl.querySelector(`.${settings.titleButtonClass}`);
      const contentDiv = itemEl.querySelector(`.${settings.contentDropdownClass}`);
      const descriptionDiv = contentDiv
        ? contentDiv.querySelector(`.${settings.contentDescriptionClass}`)
        : null;
      return { titleButton, contentDiv, descriptionDiv };
    }

    function openAccordion(accordionId) {
      const targetItemEl = el.querySelector(
        `.${settings.itemClass}[data-accordion-id="${accordionId}"]`
      );
      if (!targetItemEl || targetItemEl.dataset.isItemAnimating === "true") return;

      const target = getItemParts(targetItemEl);
      if (!target.titleButton || !target.contentDiv || !target.descriptionDiv)
        return;

      const isCurrentlyExpanded = targetItemEl.dataset.isOpen === "true";

      if (!settings.allowMultipleOpen && !isCurrentlyExpanded) {
        el.querySelectorAll(`.${settings.itemClass}`).forEach((item) => {
          if (
            item.dataset.accordionId !== accordionId &&
            item.dataset.isOpen === "true"
          ) {
            const parts = getItemParts(item);
            if (parts.titleButton && parts.contentDiv && parts.descriptionDiv) {
              performClose(item, parts.titleButton, parts.contentDiv, parts.descriptionDiv);
            }
          }
        });
      }

      if (isCurrentlyExpanded) {
        performClose(targetItemEl, target.titleButton, target.contentDiv, target.descriptionDiv);
      } else {
        performOpen(targetItemEl, target.titleButton, target.contentDiv, target.descriptionDiv);
        if (el.dataset.updateUrl === "true" || settings.updateUrl) {
          if (window.location.hash !== `#${accordionId}`) {
            instance.programmaticHashChangeInProgress = true;
            window.location.hash = accordionId;
          }
        }
      }
    }

    /* --- Build the DOM ------------------------------------------------- */

    function buildAccordions() {
      el.innerHTML = "";

      const ul = document.createElement("ul");
      ul.className = settings.containerClass || "accordion-items-container";
      ul.dataset.shouldAllowMultipleOpenItems = settings.allowMultipleOpen;
      ul.dataset.isDividersEnabled = settings.dividersEnabled;
      ul.dataset.isFirstDividerVisible = settings.dividersShowFirst;
      ul.dataset.isLastDividerVisible = settings.dividersShowLast;
      ul.dataset.isExpandedFirstItem =
        settings.initialOpen === "first" || settings.initialOpen === 0;
      ul.dataset.accordionTitleAlignment = settings.titleAlignment;
      ul.dataset.accordionIconPlacement = settings.iconPlacement;
      el.appendChild(ul);

      const itemsToOpenInitially = new Set();
      const initialSetting = settings.initialOpen;

      if (initialSetting !== null && initialSetting !== false) {
        if (initialSetting === "all" && settings.allowMultipleOpen) {
          instance.accordions.forEach((accData) => {
            if (accData.item && typeof accData.item.title === "string") {
              itemsToOpenInitially.add(turnStringIntoId(accData.item.title));
            }
          });
        } else if (
          initialSetting === "first" ||
          (initialSetting === "all" && !settings.allowMultipleOpen)
        ) {
          const first = instance.accordions[0];
          if (first && first.item && typeof first.item.title === "string") {
            itemsToOpenInitially.add(turnStringIntoId(first.item.title));
          }
        } else if (typeof initialSetting === "number" && initialSetting > 0) {
          const itemIndex = initialSetting - 1; // 1-based human number
          const target = instance.accordions[itemIndex];
          if (target && target.item && typeof target.item.title === "string") {
            itemsToOpenInitially.add(turnStringIntoId(target.item.title));
          }
        } else if (
          typeof initialSetting === "string" &&
          initialSetting !== "all" &&
          initialSetting !== "first"
        ) {
          itemsToOpenInitially.add(initialSetting); // specific id
        }
      }

      let firstMarkedToOpenProcessed = false;

      instance.accordions.forEach((accordionData, index) => {
        const accordionItem = accordionData.item;
        const itemId = turnStringIntoId(accordionItem.title);
        const isFirstItem = index === 0;
        const isLastItem = index === instance.accordions.length - 1;

        const itemElement = document.createElement("li");
        itemElement.classList.add(settings.itemClass, "sdl-accordion-item");
        itemElement.dataset.accordionId = itemId;

        if (settings.dividersEnabled && isFirstItem && settings.dividersShowFirst) {
          const topDivider = document.createElement("div");
          topDivider.className = `${settings.dividersClass} ${settings.dividersTopClass}`;
          topDivider.setAttribute("aria-hidden", "true");
          itemElement.appendChild(topDivider);
        }

        const titleWrapper = document.createElement(settings.titleTag);
        titleWrapper.className = settings.titleWrapperClass;
        titleWrapper.setAttribute("role", "heading");
        titleWrapper.setAttribute("aria-level", "3");

        const titleButton = document.createElement("button");
        titleButton.className = settings.titleButtonClass;
        titleButton.id = `button-${itemId}`;
        titleButton.setAttribute("aria-controls", `dropdown-${itemId}`);

        const maxWidthSpan = document.createElement("span");
        maxWidthSpan.className = "max-width-span";

        const titleTextSpan = document.createElement("span");
        titleTextSpan.className = settings.titleTextClass;
        titleTextSpan.textContent = accordionItem.title;
        maxWidthSpan.appendChild(titleTextSpan);

        if (settings.titleDescriptions) {
          const description = accordionItem.seoData?.seoDescription || "";
          const descriptionSpan = document.createElement("span");
          descriptionSpan.className = settings.titleDescriptionClass;
          descriptionSpan.textContent = description;
          titleTextSpan.appendChild(descriptionSpan);
        }

        const iconStyle = settings.iconStyle;
        if (iconStyle) {
          const iconContainer = document.createElement("div");
          iconContainer.innerHTML = settings.icons[iconStyle] || iconStyle;
          iconContainer.className = settings.iconContainerClass;
          iconContainer.setAttribute("aria-hidden", "true");
          maxWidthSpan.appendChild(iconContainer);
          if (iconStyle !== "arrow" && iconStyle !== "plus") {
            el.dataset.customIcon = iconStyle;
          }
        }

        titleButton.appendChild(maxWidthSpan);
        titleWrapper.appendChild(titleButton);
        itemElement.appendChild(titleWrapper);

        const contentDropdownDiv = document.createElement("div");
        contentDropdownDiv.className = settings.contentDropdownClass;
        contentDropdownDiv.id = `dropdown-${itemId}`;
        contentDropdownDiv.setAttribute("role", "region");
        contentDropdownDiv.setAttribute("aria-labelledby", `button-${itemId}`);

        const contentDescriptionDiv = document.createElement("div");
        contentDescriptionDiv.className = settings.contentDescriptionClass;
        if (accordionItem.els && accordionItem.els.length > 0) {
          accordionItem.els.forEach((moved) => {
            if (moved && moved.parentNode) moved.parentNode.removeChild(moved);
            if (moved) contentDescriptionDiv.appendChild(moved);
          });
        } else if (accordionItem.body) {
          // Portfolio page sections arrive wrapped in "<div id='sections'>".
          // Unwrap them so the markup matches a real page and we don't create
          // duplicate id="sections" across accordion items.
          const tmp = document.createElement("div");
          tmp.innerHTML = accordionItem.body;
          const sectionsWrap = tmp.querySelector("#sections");
          if (sectionsWrap) {
            while (sectionsWrap.firstChild) {
              contentDescriptionDiv.appendChild(sectionsWrap.firstChild);
            }
          } else {
            contentDescriptionDiv.innerHTML = accordionItem.body;
          }
        }
        contentDropdownDiv.appendChild(contentDescriptionDiv);
        itemElement.appendChild(contentDropdownDiv);

        if (settings.dividersEnabled) {
          if (isLastItem && settings.dividersShowLast) {
            const bottomDivider = document.createElement("div");
            bottomDivider.className = settings.dividersClass;
            bottomDivider.setAttribute("aria-hidden", "true");
            itemElement.appendChild(bottomDivider);
          } else if (!isLastItem) {
            const bottomDivider = document.createElement("div");
            bottomDivider.className = settings.dividersClass;
            bottomDivider.setAttribute("aria-hidden", "true");
            itemElement.appendChild(bottomDivider);
          }
        }

        ul.appendChild(itemElement);

        let shouldThisBeOpen = itemsToOpenInitially.has(itemId);
        if (!settings.allowMultipleOpen && shouldThisBeOpen) {
          if (firstMarkedToOpenProcessed) {
            shouldThisBeOpen = false;
          } else {
            firstMarkedToOpenProcessed = true;
          }
        }

        if (shouldThisBeOpen) {
          titleButton.setAttribute("aria-expanded", "true");
          contentDropdownDiv.style.display = "block";
          itemElement.dataset.isOpen = "true";
          contentDropdownDiv.style.maxHeight = "none";
        } else {
          titleButton.setAttribute("aria-expanded", "false");
          itemElement.dataset.isOpen = "false";
          contentDropdownDiv.style.maxHeight = "0px";
        }

        titleButton.addEventListener("click", () => openAccordion(itemId));
      });
    }

    /* --- Per-item CSS descriptions ------------------------------------ */

    function applyCustomDescriptionFromCSS() {
      const itemElements = el.querySelectorAll(
        `.${settings.itemClass}[data-accordion-id]`
      );
      itemElements.forEach((itemElement) => {
        const descriptionSpan = itemElement.querySelector(
          `.${settings.titleDescriptionClass}`
        );
        if (!descriptionSpan) return;
        const computedStyle = window.getComputedStyle(itemElement);
        let value = computedStyle.getPropertyValue("--sdl-accordion-description").trim();
        if (!value) return;
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.substring(1, value.length - 1);
        }
        descriptionSpan.textContent = value;
      });
    }

    /* --- Hash navigation ---------------------------------------------- */

    function handleHashNavigation() {
      if (instance.programmaticHashChangeInProgress) {
        instance.programmaticHashChangeInProgress = false;
        return;
      }
      if (!window.location.hash) return;

      const hashId = window.location.hash.replace("#", "");
      const targetItem = el.querySelector(
        `.${settings.itemClass}[data-accordion-id="${hashId}"]`
      );
      if (!targetItem) return;

      if (!settings.allowMultipleOpen) {
        el.querySelectorAll(`.${settings.itemClass}`).forEach((item) => {
          if (item !== targetItem && item.dataset.isOpen === "true") {
            const parts = getItemParts(item);
            if (parts.titleButton && parts.contentDiv && parts.descriptionDiv) {
              performClose(item, parts.titleButton, parts.contentDiv, parts.descriptionDiv);
            }
          }
        });
      }

      if (targetItem.dataset.isOpen !== "true") {
        const parts = getItemParts(targetItem);
        if (parts.titleButton && parts.contentDiv && parts.descriptionDiv) {
          performOpen(targetItem, parts.titleButton, parts.contentDiv, parts.descriptionDiv);
        }
      }

      setTimeout(() => {
        targetItem.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 400);
    }

    /* --- Initialisation ----------------------------------------------- */

    async function init() {
      emitEvent(`${PLUGIN_TITLE}:beforeInit`);

      if (source) {
        instance.installationMethod = "source";
        const { items } = await collectionData(source, {
          weglotPaths: settings.weglotPaths,
        });
        const accordionLimit =
          typeof settings.accordionLimit === "number"
            ? Math.min(settings.accordionLimit, items.length)
            : items.length;
        instance.accordions = items.slice(0, accordionLimit).map((item) => ({ item }));
      } else if (el.querySelector("button")) {
        instance.installationMethod = "elements";
        const thisSection = el.closest("section");
        let currentSection = thisSection;

        instance.accordions = Array.from(el.querySelectorAll("button")).map((button) => {
          const newItem = { title: button.textContent, els: [] };
          const dataTarget = button.dataset.target;

          if (dataTarget) {
            dataTarget
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
              .forEach((selector) => {
                newItem.els.push(...Array.from(document.querySelectorAll(selector)));
              });
          } else if (currentSection) {
            const nextEl = currentSection.nextElementSibling;
            if (nextEl) {
              newItem.els.push(nextEl);
              currentSection = nextEl;
            }
          } else {
            console.warn(
              "sdlAccordions: could not find parent section for button",
              button
            );
          }
          return { item: newItem };
        });

        addEditModeObserver();
      } else {
        return;
      }

      instance.programmaticHashChangeInProgress = false;
      setIsFullWidth();
      buildAccordions();
      el.dataset.loadingState = "loaded";

      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", handleDOMReady);
      } else {
        await handleDOMReady();
      }
    }

    async function handleDOMReady() {
      const sections = document.querySelector("#sections, #page-regions");
      const lastSection = document.querySelector(
        "#sections > section:last-child .content-wrapper, #page-regions > section:last-child .content-wrapper"
      );

      const originalParent = el.parentNode;
      let wasAppended = false;

      if (sections && !sections.contains(el) && lastSection) {
        lastSection.appendChild(el);
        wasAppended = true;
        await reloadSquarespaceLifecycle([el]);
        window.dispatchEvent(new Event("resize"));
      } else {
        await reloadSquarespaceLifecycle([el]);
      }

      if (wasAppended && originalParent) originalParent.appendChild(el);

      // Re-lay-out galleries once the accordion is back in its final position
      // (the container width can differ from where the lifecycle reload ran).
      layoutGalleries(el);

      // Initialise video embeds, scripts, and forms. Scripts must run before
      // forms are hydrated (scripts may register React component dependencies).
      if (window.Squarespace) {
        handleAddingMissingColorTheme();
        renderVideoEmbeds(el);
        executeScripts(el).then(() => reinitializeForms(el));
      }

      if (!instance.fullWidthResizeListenerSet && !settings.isFullWidth) {
        window.addEventListener("resize", setIsFullWidth);
        instance.fullWidthResizeListenerSet = true;
      }

      // Masonry galleries position items by pixel and must be recomputed when
      // the viewport changes. Open items use max-height:none so they reflow.
      if (!instance.galleryResizeListenerSet) {
        let rafId;
        instance.galleryResizeHandler = () => {
          if (rafId) cancelAnimationFrame(rafId);
          rafId = requestAnimationFrame(() => layoutGalleries(el));
        };
        window.addEventListener("resize", instance.galleryResizeHandler);
        instance.galleryResizeListenerSet = true;
      }

      if (settings.titleDescriptions) applyCustomDescriptionFromCSS();

      handleHashNavigation();

      if (!instance.hashChangeListenerSet) {
        instance.boundHandleHashNavigation = handleHashNavigation;
        window.addEventListener("hashchange", instance.boundHandleHashNavigation);
        instance.hashChangeListenerSet = true;
      }

      if (settings.appendAfterBuild) {
        // Continuity workaround for accordion in product details.
        if (settings.appendAfterBuild === ".ProductItem-details-checkout") {
          settings.appendAfterBuild =
            ".ProductItem-details-checkout, .product-detail .product-meta";
          el.dataset.appendAfterBuild = settings.appendAfterBuild;
        }
        const referenceEl = document.querySelector(settings.appendAfterBuild);
        if (referenceEl) referenceEl.appendChild(el);
      }

      emitEvent(`${PLUGIN_TITLE}:ready`);
    }

    // Public, minimal instance API (used by the events docs).
    instance.openAccordion = openAccordion;
    instance.rebuild = buildAccordions;
    el.sdlAccordions = instance;

    init();
    return instance;
  }

  /* ------------------------------------------------------------------ *
   *  Boot
   * ------------------------------------------------------------------ */

  function initAccordions() {
    const els = document.querySelectorAll(PLUGIN_SELECTOR);
    if (!els.length) return;
    els.forEach((el) => createAccordion(el));
  }

  window.sdlAccordions = { init: initAccordions, create: createAccordion };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAccordions);
  } else {
    initAccordions();
  }
  // Squarespace AJAX page transitions.
  window.addEventListener("mercury:load", initAccordions);
})();
