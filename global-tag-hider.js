// =============================================
// Global Tag Hider - Gay Edition
// =============================================

const STORAGE_KEY                = "gth_hiddenTagIds";
const DEFAULTS_APPLIED_KEY       = "gth_defaultsApplied";
const REPLACE_KEY                = "gth_replaceWithStraight";
const REPLACE_TAG_KEY            = "gth_replacementTag";
const SHOW_FAB_KEY               = "gth_showFAB";
const HIDE_FEMALE_PERFORMERS_KEY = "gth_hideFemalePerformers";

let hiddenTagIds          = new Set();
let femalePerformerIds    = new Set();
let allTagsMap            = new Map();
let tagNameToId           = new Map();
let replaceWithStraight   = false;
let replacementTagName    = "Straight Sex";
let showFAB               = true;
let hideFemalePerformers  = false;
let hideObserver          = null;
let _cachedHiddenTagObj   = null;
let _totalHiddenSceneCount = null;  // sum of scenes across ALL hidden tags (from warmFetchCache)
let _origFetch            = null;   // pre-interceptor fetch, used by warmFetchCache

const DEFAULT_HIDDEN_TAGS = [
  // Tits / boobs
  "Big Tits", "Small Tits", "Natural Tits", "Fake Tits", "Huge Tits", "Medium Tits", "Tiny Tits",
  "Cum on Tits", "Tit Worship", "Titjob", "Titty Fuck",
  "Fake Boobs", "Medium Boobs",
  // Pussy
  "Pussy", "Trimmed Pussy", "Innie Pussy", "Outie Pussy", "Cum on Pussy",
  "Pussy Licking", "Pussy Fingering", "Pussy Rubbing", "Pussy Gape",
  // Cowgirl positions
  "Cowgirl", "Reverse Cowgirl", "Anal Cowgirl", "Anal Reverse Cowgirl",
  // Age / body descriptors
  "Schoolgirl", "Teen Girl (18\u201322)",
  "Girlfriend", "Other Person's Girlfriend", "For Girls",
  "Young Woman (22-30)", "Young Woman (22\u201330)", "Woman 30-39",
  "Short Woman", "Average Height Woman", "Tall Woman",
  "White Woman", "Latin Woman", "Latina Woman",
  // Hair colour (Female)
  "Black Hair (Female)", "Blonde Hair (Female)", "Brown Hair (Female)", "Red Hair (Female)",
  // Solo / trans
  "Solo Female", "Transgender (Female)",
  // Accessories
  "Woman's Heels",
  // Vaginal sex acts
  "Vaginal Sex", "Vaginal Penetration", "All Vaginal",
];

// ---- Storage ----

function loadHiddenTags() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    hiddenTagIds = new Set(stored ? JSON.parse(stored) : []);
  } catch (e) { hiddenTagIds = new Set(); }
}

function saveHiddenTags() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...hiddenTagIds]));
  } catch (e) { console.error("[GlobalTagHider] Save failed:", e); }
}

function loadPreferences() {
  replaceWithStraight  = localStorage.getItem(REPLACE_KEY)                === "true";
  replacementTagName   = localStorage.getItem(REPLACE_TAG_KEY)            || "Straight Sex";
  showFAB              = localStorage.getItem(SHOW_FAB_KEY)               !== "false";
  hideFemalePerformers = localStorage.getItem(HIDE_FEMALE_PERFORMERS_KEY) === "true";
}

function savePreferences() {
  localStorage.setItem(REPLACE_KEY,                String(replaceWithStraight));
  localStorage.setItem(REPLACE_TAG_KEY,            replacementTagName);
  localStorage.setItem(SHOW_FAB_KEY,               String(showFAB));
  localStorage.setItem(HIDE_FEMALE_PERFORMERS_KEY, String(hideFemalePerformers));
}

// ---- GraphQL ----

async function callGQL(query, variables = {}) {
  const resp = await fetch("/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables })
  });
  return resp.json();
}

async function loadAllTags() {
  const result = await callGQL(`
    query FindAllTags {
      findTags(filter: { per_page: -1 }) { tags { id name } }
    }
  `);
  const tags = result.data?.findTags?.tags || [];
  allTagsMap  = new Map(tags.map(t => [String(t.id), t.name]));
  tagNameToId = new Map(tags.map(t => [t.name.toLowerCase(), String(t.id)]));
  return tags;
}

async function loadFemalePerformers() {
  if (!hideFemalePerformers) return;
  const result = await callGQL(`
    query FindFemalePerformers {
      findPerformers(
        performer_filter: { gender: { value: FEMALE, modifier: EQUALS } }
        filter: { per_page: -1 }
      ) { performers { id } }
    }
  `);
  const performers = result.data?.findPerformers?.performers || [];
  femalePerformerIds = new Set(performers.map(p => String(p.id)));
  console.log(`[GlobalTagHider] Loaded ${femalePerformerIds.size} female performers`);
}

// ---- Defaults ----

async function ensureDefaults() {
  const flagSet = localStorage.getItem(DEFAULTS_APPLIED_KEY) === "true";
  if (flagSet && hiddenTagIds.size > 0) return;
  if (allTagsMap.size === 0) await loadAllTags();
  let added = 0;
  for (const name of DEFAULT_HIDDEN_TAGS) {
    const id = tagNameToId.get(name.toLowerCase());
    if (id && !hiddenTagIds.has(id)) { hiddenTagIds.add(id); added++; }
  }
  if (added > 0) { saveHiddenTags(); console.log(`[GlobalTagHider] Applied defaults: hid ${added} tags`); }
  localStorage.setItem(DEFAULTS_APPLIED_KEY, "true");
}

// ---- Hiding ----

function getHiddenTagNames() {
  const names = new Set();
  for (const id of hiddenTagIds) {
    const name = allTagsMap.get(id);
    if (name) names.add(name.toLowerCase());
  }
  return names;
}

// Walk up from an element to find a card-sized container
function findContainer(el, maxLevels = 6) {
  let node = el.parentElement;
  for (let i = 0; i < maxLevels; i++) {
    if (!node || node === document.body) break;
    if (node.offsetHeight > 60 && node.offsetWidth > 60) return node;
    node = node.parentElement;
  }
  return el;
}

function applyHiding() {
  if (hiddenTagIds.size === 0 && femalePerformerIds.size === 0) return;
  const hiddenNames = getHiddenTagNames();

  // Find the right leaf element to write the replacement label into.
  // We must NEVER call textContent= on an element that has child elements —
  // doing so destroys those children (including the <a> link we depend on for
  // future applyHiding() calls), which is why "Straight" would persist forever.
  //
  // Rules:
  //  • If the container has a heading that is a leaf AND is NOT an ancestor/
  //    descendant of the link, use the heading (tag-card case).
  //  • Otherwise write directly to the link (scene-detail badge case).
  function textTarget(link, container) {
    const heading = container.querySelector(
      "h5, h4, h3, h2, [class*='title'], [class*='Title']"
    );
    // Return the heading when it is a leaf text element AND the link is NOT
    // nested inside it.  That covers both:
    //   • heading inside the link  (link wraps heading — most Stash tag cards)
    //   • heading beside the link  (siblings)
    // The one case we must NOT use the heading is when it contains the link —
    // overwriting heading.textContent would then destroy the link itself.
    if (heading && !heading.firstElementChild && !heading.contains(link)) {
      return heading;
    }
    return link;
  }

  // Per-applyHiding() set that tracks which "groups" have already received a
  // replacement label.  Used only for inline-badge contexts (scene detail etc.)
  // so that multiple hidden tags in the same row collapse into one label.
  // Tag-card contexts (Tags list page) are NOT deduplicated — each card shows
  // its own replacement label independently.
  const replacedGroups = new Set();

  function processTagLink(link, container) {
    if (replaceWithStraight) {
      // Determine context:
      //   • "inline badge" — container is the link itself or a small badge wrapper
      //     (scene detail tags row).  Deduplicate: first hidden tag in the row
      //     shows the replacement label; subsequent ones are hidden.
      //   • "card" — container is a standalone tag card (Tags list page).
      //     No deduplication — every card shows its own replacement label.
      const isInlineBadge = container === link ||
        !!(container.matches && container.matches(
          ".badge, [class*='tag-item'], [class*='TagLink'], [class*='tag-link']"
        ));

      if (isInlineBadge) {
        // Group key: the element that holds all sibling badges together.
        const group = container.parentElement || container;
        if (replacedGroups.has(group)) {
          container.style.display = "none";
          return;
        }
        replacedGroups.add(group);

        // When the container fell back to the link itself, the parent tag card
        // may still have display:none from a previous hide-mode run.  Walk up
        // and un-hide the nearest card ancestor so the replacement is visible.
        if (container === link) {
          const ancestorCard = link.closest(".tag-card, [class*='TagCard'], .card");
          if (ancestorCard && ancestorCard.style.display === "none") {
            ancestorCard.style.display = "";
          }
        }
      }

      const t = textTarget(link, container);
      if (t.textContent.trim() !== replacementTagName) t.textContent = replacementTagName;
      container.style.display = "";
    } else {
      container.style.display = "none";
    }
  }

  // --- Pass 1: links whose href contains /tags/ ---
  document.querySelectorAll('a[href*="/tags/"]').forEach(link => {
    // Skip image-only wrappers (e.g. the thumbnail <a><img/></a> on tag cards).
    // Processing these would destroy the <img> child when setting textContent.
    if (!link.textContent.trim()) return;

    const href = link.getAttribute("href");
    const match = href.match(/\/tags\/(\d+)/);

    // Primary: numeric ID.  Fallback: name-slug URL — stamp data-gth-hidden so
    // subsequent calls can still find the link after its text has been mutated.
    let isHidden = false;
    if (match) {
      isHidden = hiddenTagIds.has(match[1]);
    } else if (link.dataset.gthHidden) {
      isHidden = true;
    } else {
      const textName = link.textContent.trim().toLowerCase();
      if (hiddenNames.has(textName)) { isHidden = true; link.dataset.gthHidden = "1"; }
    }
    if (!isHidden) return;

    // .tag-card / TagCard first (specific), then badge / tag-item wrappers,
    // then size check (inline badges return the link itself — avoids grabbing
    // the whole scene panel card that wraps scene-detail tag badges),
    // then generic .card as last resort.
    const container =
      link.closest(".tag-card, [class*='TagCard']") ||
      link.closest(".badge, [class*='tag-item'], [class*='TagLink'], [class*='tag-link']") ||
      (link.offsetHeight < 50 ? link : null) ||
      link.closest("li, [class*='col']") ||
      link.closest(".card") ||
      findContainer(link);

    processTagLink(link, container);
  });

  // --- Pass 2: links whose href does NOT contain /tags/ ---
  // Catches scene-detail tag badges that Stash renders with hash routing
  // (#/tags/…) or other non-standard href patterns.
  // Restricted to links inside a tag-context ancestor to avoid false positives
  // on navigation links that happen to share a tag name.
  document.querySelectorAll('a:not([href*="/tags/"])').forEach(link => {
    if (!link.dataset.gthHidden) {
      const textName = link.textContent.trim().toLowerCase();
      if (!hiddenNames.has(textName)) return;
      if (!link.closest(
        '[class*="tag"], [class*="Tag"], [class*="badge"], [class*="Badge"], ' +
        '[class*="detail"], [class*="Detail"]'
      )) return;
      link.dataset.gthHidden = "1";
    }

    const container =
      link.closest(".badge, [class*='tag-item'], [class*='TagLink'], [class*='tag-link']") ||
      (link.offsetHeight < 50 ? link : null) ||
      link.closest("li") ||
      link;

    processTagLink(link, container);
  });

  // --- Female performer cards / links (everywhere) ---
  if (hideFemalePerformers && femalePerformerIds.size > 0) {
    document.querySelectorAll('a[href*="/performers/"]').forEach(link => {
      const match = link.getAttribute("href").match(/\/performers\/(\d+)/);
      if (!match || !femalePerformerIds.has(match[1])) return;
      const container =
        link.closest(".card, .performer-card, li, [class*='col'], [class*='performer']")
        || findContainer(link);
      container.style.display = "none";
    });
  }

  // --- react-select dropdown options ---
  // We store the original tag text in data-gth-orig-text before the first rename
  // so that subsequent applyHiding() calls can still identify this element as a
  // hidden-tag option even after its visible text has been changed.
  // Without this, a renamed option ("Straight Studs Fucking") no longer matches
  // hiddenNames, causing each new call to promote the next hidden option into a
  // second visible replacement — cascading until all options show the label.
  let replacementOptionDone = false;
  document.querySelectorAll(".react-select__option").forEach(el => {
    const origText = el.dataset.gthOrigText || el.textContent.trim();
    if (!hiddenNames.has(origText.toLowerCase())) return;
    if (!el.dataset.gthOrigText) el.dataset.gthOrigText = el.textContent.trim();
    if (replaceWithStraight && !replacementOptionDone) {
      if (el.textContent.trim() !== replacementTagName) el.textContent = replacementTagName;
      el.style.display = ""; replacementOptionDone = true;
    } else { el.style.display = "none"; }
  });

  // --- Selected tag chips ---
  // Same dedup pattern as dropdown options: only the first hidden chip is shown
  // as the replacement label; subsequent hidden chips are hidden entirely.
  // When the user removes the visible chip, the next hidden one becomes visible.
  let replacedChipDone = false;
  document.querySelectorAll(".react-select__multi-value").forEach(el => {
    const label = el.querySelector(".react-select__multi-value__label");
    if (!label) return;
    const origText = label.dataset.gthOrigText || label.textContent.trim();
    if (!hiddenNames.has(origText.toLowerCase())) return;
    if (!label.dataset.gthOrigText) label.dataset.gthOrigText = label.textContent.trim();
    if (replaceWithStraight) {
      if (replacedChipDone) {
        el.style.display = "none";
      } else {
        if (label.textContent !== replacementTagName) label.textContent = replacementTagName;
        el.style.display = "";
        replacedChipDone = true;
      }
    } else { el.style.display = "none"; }
  });
}

// ---- Debounced DOM change handler ----

let changeScheduled = false;
function onDOMChange() {
  if (changeScheduled) return;
  changeScheduled = true;
  setTimeout(() => {
    changeScheduled = false;
    applyHiding();
    injectTagsPageButton();
    injectSettingsPanel();
  }, 150);
}

// ---- Tags page toolbar button ----

function isTagsPage() {
  const path = window.location.pathname + window.location.hash;
  return /\/(#\/)?tags(\/|$|\?)/.test(path);
}

function makeToolbarBtn() {
  const btn = document.createElement("button");
  btn.id = "gth-tags-btn";
  btn.className = "btn btn-secondary btn-sm";
  btn.style.marginLeft = "8px";
  btn.textContent = "Tag Hider";
  btn.title = "Global Tag Hider — manage hidden tags";
  btn.onclick = showModal;
  return btn;
}

function injectTagsPageButton() {
  if (!isTagsPage() || document.getElementById("gth-tags-btn")) return;

  const mainEl = document.querySelector("main");

  // Strategy 1: Bootstrap utility classes — these are never hashed by CSS modules.
  // Stash puts sort/filter controls inside a .ml-auto flex row.
  const bootstrapRow =
    document.querySelector("main .ml-auto") ||
    document.querySelector("main .justify-content-end.d-flex") ||
    document.querySelector("main .d-flex.justify-content-end");
  if (bootstrapRow) {
    bootstrapRow.appendChild(makeToolbarBtn());
    if (document.getElementById("gth-tags-btn")) return;
  }

  // Strategy 2: Find by structure — walk buttons near the top of <main>
  // and append into their immediate parent (the toolbar row).
  if (mainEl) {
    const btns = [...mainEl.querySelectorAll("button.btn")];
    for (const btn of btns) {
      const rect = btn.getBoundingClientRect();
      if (rect.top < 0 || rect.top > 200) continue;
      const parent = btn.parentElement;
      if (parent && !parent.querySelector("#gth-tags-btn")) {
        parent.appendChild(makeToolbarBtn());
        if (document.getElementById("gth-tags-btn")) return;
      }
      break;
    }
  }

  // Strategy 3: Before the first tag card grid
  const firstCard = mainEl?.querySelector(".card, [class*='card'], [class*='Card']");
  if (firstCard) {
    const wrapper = document.createElement("div");
    wrapper.style.cssText = "display:flex;justify-content:flex-end;padding:4px 8px 12px;";
    wrapper.appendChild(makeToolbarBtn());
    firstCard.parentElement?.parentElement?.insertBefore(wrapper, firstCard.parentElement);
    if (document.getElementById("gth-tags-btn")) return;
  }

  // Strategy 4: Fixed-position fallback — appended to document.body so React can never
  // remove it. Aligns vertically with whichever toolbar buttons are on-screen.
  if (!document.getElementById("gth-tags-btn-wrapper")) {
    const mainBtn = mainEl?.querySelector("button.btn");
    let topPx = 64;
    if (mainBtn) {
      const r = mainBtn.getBoundingClientRect();
      // Centre our button on the same horizontal band as the toolbar buttons
      topPx = Math.round(r.top + window.scrollY + r.height / 2 - 15);
    }
    const wrapper = document.createElement("div");
    wrapper.id = "gth-tags-btn-wrapper";
    wrapper.style.cssText =
      `position:fixed;top:${topPx}px;right:16px;z-index:8500;` +
      "display:flex;align-items:center;";
    wrapper.appendChild(makeToolbarBtn());
    document.body.appendChild(wrapper);
  }
}

// ---- Replacement-tag selector helper ----

const PRESET_REPLACEMENT_TAGS = ["Straight", "Straight Sex"];

function replacementTagSelectorHTML(idPrefix) {
  const isCustom = !PRESET_REPLACEMENT_TAGS.includes(replacementTagName);
  return `
    <div id="${idPrefix}-opts" style="${replaceWithStraight ? "" : "display:none;"}margin-top:8px;margin-left:26px;">
      <select id="${idPrefix}-select"
        style="background:#27273a;color:#e0e0ff;border:1px solid #6366f1;
               border-radius:6px;padding:4px 10px;font-size:0.88rem;cursor:pointer;">
        <option value="Straight"     ${replacementTagName === "Straight"     ? "selected" : ""}>Straight</option>
        <option value="Straight Sex" ${replacementTagName === "Straight Sex" ? "selected" : ""}>Straight Sex</option>
        <option value="__custom__"   ${isCustom ? "selected" : ""}>Custom…</option>
      </select>
      <input type="text" id="${idPrefix}-custom"
        placeholder="Custom label"
        value="${isCustom ? replacementTagName : ""}"
        style="${isCustom ? "" : "display:none;"}margin-top:6px;width:160px;
               background:#27273a;color:#e0e0ff;border:1px solid #6366f1;
               border-radius:6px;padding:4px 10px;font-size:0.88rem;">
    </div>`;
}

function wireReplacementTagSelector(idPrefix) {
  const sel    = document.getElementById(`${idPrefix}-select`);
  const custom = document.getElementById(`${idPrefix}-custom`);
  if (!sel || !custom) return;

  sel.onchange = () => {
    if (sel.value === "__custom__") {
      custom.style.display = "";
      custom.focus();
    } else {
      custom.style.display = "none";
      replacementTagName = sel.value;
      savePreferences(); applyHiding();
    }
  };
  custom.oninput = () => {
    if (custom.value.trim()) {
      replacementTagName = custom.value.trim();
      savePreferences(); applyHiding();
    }
  };
}

// ---- Settings page panel ----

function isSettingsPage() {
  const url = window.location.pathname + window.location.search + window.location.hash;
  return url.toLowerCase().includes("settings");
}

function findPluginCard() {
  // "Global Tag Hider" text appears in multiple sections:
  //   • Plugins           — loaded plugin entries; THIS is where we want our panel
  //   • Installed Plugins — installed package rows (Uninstall / Remove buttons)
  //   • Available Plugins — package registry rows  (Install / Update buttons)
  //
  // We collect all candidate card-like ancestors, then rank them using two
  // independent signals:
  //   1. Section heading — walk up checking preceding-sibling headings; if a
  //      heading says "Installed" or "Available" we know it is the wrong section.
  //   2. Package-action buttons — a card that contains install / update /
  //      uninstall / remove buttons belongs to a package management section.
  // The "Plugins" (running) entry has neither signal, so it wins.

  const candidates = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node;

  while ((node = walker.nextNode())) {
    if (!node.textContent.trim().startsWith("Global Tag Hider")) continue;

    let el = node.parentElement;
    let card = null;
    while (el && el !== document.body) {
      const tag = el.tagName.toLowerCase();
      const cls = (el.className || "").toLowerCase();
      if (
        tag === "li" || tag === "article" || tag === "section" ||
        cls.includes("card") || cls.includes("plugin") || cls.includes("panel")
      ) { card = el; break; }
      const rect = el.getBoundingClientRect();
      if (tag === "div" && rect.width > window.innerWidth * 0.4 && rect.height > 50)
        { card = el; break; }
      el = el.parentElement;
    }
    if (!card) {
      // Fallback: 4 levels up
      card = node.parentElement;
      for (let i = 0; i < 4; i++) {
        if (card?.parentElement && card.parentElement !== document.body)
          card = card.parentElement;
      }
    }
    if (card && !candidates.includes(card)) candidates.push(card);
  }

  if (!candidates.length) return null;

  // Signal 1 helper — find the most-recent heading element that precedes `el`
  // in the DOM (as a preceding sibling of any ancestor).  Returns its text, or "".
  function nearestPrecedingHeading(el) {
    let ancestor = el;
    while (ancestor && ancestor !== document.body) {
      let sib = ancestor.previousElementSibling;
      while (sib) {
        if (/^h[1-6]$/i.test(sib.tagName)) return sib.textContent.trim();
        // Also check the last heading *inside* the sibling block
        const inner = [...sib.querySelectorAll("h1,h2,h3,h4,h5,h6")].pop();
        if (inner) return inner.textContent.trim();
        sib = sib.previousElementSibling;
      }
      ancestor = ancestor.parentElement;
    }
    return "";
  }

  // Signal 2 helper — does the card contain a package-management action button?
  function hasPackageAction(card) {
    return [...card.querySelectorAll("button, [role='button'], a[role='button']")]
      .some(b => /\b(install|update|uninstall|remove)\b/i.test(b.textContent.trim()));
  }

  // First pass — must pass BOTH signals (preferred: cleanly in the Plugins section)
  for (const card of candidates) {
    const heading = nearestPrecedingHeading(card);
    if (/\b(installed|available)\b/i.test(heading)) continue;
    if (!hasPackageAction(card)) return card;
  }

  // Second pass — at least no package-action buttons
  for (const card of candidates) {
    if (!hasPackageAction(card)) return card;
  }

  // Last resort — return the first candidate
  return candidates[0];
}

function injectSettingsPanel() {
  if (!isSettingsPage() || document.getElementById("gth-settings-panel")) return;

  const card = findPluginCard();
  if (!card) {
    // Plugin list may not be rendered yet — keep retrying every 600ms
    if (!injectSettingsPanel._retrying) {
      injectSettingsPanel._retrying = true;
      const interval = setInterval(() => {
        if (!isSettingsPage()) { clearInterval(interval); injectSettingsPanel._retrying = false; return; }
        if (document.getElementById("gth-settings-panel")) { clearInterval(interval); injectSettingsPanel._retrying = false; return; }
        const c = findPluginCard();
        if (c) { clearInterval(interval); injectSettingsPanel._retrying = false; injectSettingsPanel(); }
      }, 600);
    }
    return;
  }
  injectSettingsPanel._retrying = false;

  const panel = document.createElement("div");
  panel.id = "gth-settings-panel";
  panel.style.cssText =
    "margin-top:16px;padding:14px 16px;border-top:1px solid #333;" +
    "background:#12121e;border-radius:8px;";

  panel.innerHTML = `
    <div style="font-weight:600;color:#c4b5fd;margin-bottom:14px;">⚙️ Tag Hider Settings</div>

    <div style="margin-bottom:12px;">
      <label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;">
        <input type="checkbox" id="gth-s-replace"
          style="margin-top:3px;width:15px;height:15px;cursor:pointer;"
          ${replaceWithStraight ? "checked" : ""}>
        <div style="flex:1;">
          <div style="color:#e0e0ff;font-weight:500;">Replace hidden tags with:</div>
          <div style="color:#888;font-size:0.82rem;margin-top:3px;">
            Instead of hiding, female tags appear with the label below — on tag lists,
            scene details and dropdown selectors.
          </div>
          ${replacementTagSelectorHTML("gth-s-replace-tag")}
        </div>
      </label>
    </div>

    <div style="margin-bottom:12px;">
      <label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;">
        <input type="checkbox" id="gth-s-female-performers"
          style="margin-top:3px;width:15px;height:15px;cursor:pointer;"
          ${hideFemalePerformers ? "checked" : ""}>
        <div>
          <div style="color:#e0e0ff;font-weight:500;">Hide female performers everywhere</div>
          <div style="color:#888;font-size:0.82rem;margin-top:3px;">
            Hides performer cards, thumbnails and links for performers with gender set to Female.
          </div>
        </div>
      </label>
    </div>

    <div style="margin-bottom:14px;">
      <label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;">
        <input type="checkbox" id="gth-s-fab"
          style="margin-top:3px;width:15px;height:15px;cursor:pointer;"
          ${showFAB ? "checked" : ""}>
        <div>
          <div style="color:#e0e0ff;font-weight:500;">Show floating 🙈 button</div>
          <div style="color:#888;font-size:0.82rem;margin-top:3px;">
            When disabled, use the "Tag Hider" button in the Tags page toolbar instead.
          </div>
        </div>
      </label>
    </div>

    <button id="gth-s-open" class="btn btn-primary btn-sm">Open Tag Hider</button>
  `;

  card.appendChild(panel);

  // Self-healing: if React re-renders the plugin list and removes our panel, re-inject.
  const panelObserver = new MutationObserver(() => {
    if (!document.getElementById("gth-settings-panel") && isSettingsPage()) {
      panelObserver.disconnect();
      setTimeout(injectSettingsPanel, 150);
    }
  });
  panelObserver.observe(card, { childList: true });

  wireReplacementTagSelector("gth-s-replace-tag");
  document.getElementById("gth-s-replace").onchange = e => {
    replaceWithStraight = e.target.checked; savePreferences(); applyHiding();
    if (replaceWithStraight) warmFetchCache();
    const opts = document.getElementById("gth-s-replace-tag-opts");
    if (opts) opts.style.display = replaceWithStraight ? "" : "none";
  };
  document.getElementById("gth-s-female-performers").onchange = async e => {
    hideFemalePerformers = e.target.checked; savePreferences();
    if (hideFemalePerformers && femalePerformerIds.size === 0) await loadFemalePerformers();
    applyHiding();
  };
  document.getElementById("gth-s-fab").onchange = e => {
    showFAB = e.target.checked; savePreferences();
    if (showFAB) injectFAB(); else document.getElementById("gth-fab")?.remove();
  };
  document.getElementById("gth-s-open").onclick = showModal;
}

// ---- FAB ----

function injectFAB() {
  if (!showFAB || document.getElementById("gth-fab")) return;
  const fab = document.createElement("button");
  fab.id        = "gth-fab";
  fab.innerHTML = "🙈";
  fab.title     = "Global Tag Hider";
  fab.style.cssText =
    "position:fixed;bottom:24px;right:24px;width:56px;height:56px;" +
    "border-radius:50%;background:#7c3aed;border:none;font-size:1.5rem;" +
    "cursor:pointer;z-index:9000;box-shadow:0 4px 12px rgba(124,58,237,0.5);";
  fab.onclick = showModal;
  document.body.appendChild(fab);
}

// ---- Modal ----

async function showModal() {
  loadHiddenTags(); loadPreferences();
  if (allTagsMap.size === 0) await loadAllTags();
  document.getElementById("gth-overlay")?.remove();

  const overlay = document.createElement("div");
  overlay.id = "gth-overlay";
  overlay.style.cssText =
    "position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;" +
    "display:flex;align-items:center;justify-content:center;";

  overlay.innerHTML = `
    <div class="gth-modal">
      <div style="flex-shrink:0;display:flex;justify-content:space-between;align-items:center;
                  padding:16px 24px;border-bottom:1px solid #4f46e5;">
        <h2 style="margin:0;color:#c4b5fd;font-size:1.2rem;">🙈 Global Tag Hider — Gay Edition</h2>
        <button id="gth-close"
          style="background:none;border:none;color:#e0e0ff;font-size:1.4rem;
                 cursor:pointer;line-height:1;padding:0 4px;">✕</button>
      </div>
      <div style="flex:1;min-height:0;overflow-y:auto;padding:24px;">

        <!-- Preferences -->
        <div style="background:#12121e;border:1px solid #4f46e5;border-radius:12px;
                    padding:16px;margin-bottom:20px;">
          <div style="font-weight:600;color:#c4b5fd;margin-bottom:12px;">⚙️ Preferences</div>

          <label style="display:flex;align-items:flex-start;gap:12px;cursor:pointer;">
            <input type="checkbox" id="gth-replace-toggle"
              style="margin-top:3px;width:16px;height:16px;cursor:pointer;"
              ${replaceWithStraight ? "checked" : ""}>
            <div style="flex:1;">
              <div style="color:#e0e0ff;font-weight:500;">Replace hidden tags with:</div>
              <div style="color:#a5a5d0;font-size:0.85rem;margin-top:4px;">
                Instead of hiding, female tags appear with the label below — on tag lists,
                scene details and dropdown selectors.
              </div>
              ${replacementTagSelectorHTML("gth-modal-replace-tag")}
            </div>
          </label>

          <label style="display:flex;align-items:flex-start;gap:12px;cursor:pointer;margin-top:14px;">
            <input type="checkbox" id="gth-female-performers-toggle"
              style="margin-top:3px;width:16px;height:16px;cursor:pointer;"
              ${hideFemalePerformers ? "checked" : ""}>
            <div>
              <div style="color:#e0e0ff;font-weight:500;">Hide female performers everywhere</div>
              <div style="color:#a5a5d0;font-size:0.85rem;margin-top:4px;">
                Hides performer cards, thumbnails and links for any performer whose gender
                is set to Female — on the performers page, scene cards, and scene detail.
              </div>
            </div>
          </label>

          <label style="display:flex;align-items:flex-start;gap:12px;cursor:pointer;margin-top:14px;">
            <input type="checkbox" id="gth-fab-toggle"
              style="margin-top:3px;width:16px;height:16px;cursor:pointer;"
              ${showFAB ? "checked" : ""}>
            <div>
              <div style="color:#e0e0ff;font-weight:500;">Show floating 🙈 button</div>
              <div style="color:#a5a5d0;font-size:0.85rem;margin-top:4px;">
                When disabled, use the "Tag Hider" button in the Tags page toolbar,
                or go to Settings → Plugins → Global Tag Hider to re-enable it.
              </div>
            </div>
          </label>
        </div>

        <input type="text" id="gth-search" class="gth-search" placeholder="🔍 Search tags...">
        <button id="gth-apply-defaults" class="gth-default-btn">
          🌈 Apply Gay Defaults (hide common female tags)
        </button>
        <div style="color:#a5a5d0;margin-bottom:8px;">Available Tags — click to hide</div>
        <div id="gth-available" class="gth-list"></div>
        <div style="color:#a5a5d0;margin:20px 0 8px;">
          Hidden Tags (<span id="gth-hidden-count">0</span>)
        </div>
        <div id="gth-hidden-list" class="gth-list"></div>
        <div style="margin-top:28px;text-align:right;">
          <button id="gth-unhide-all"
            style="background:#ef4444;color:white;border:none;padding:10px 20px;
                   border-radius:9999px;cursor:pointer;">Unhide All</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  overlay.addEventListener("click", e => { if (e.target === overlay) overlay.remove(); });
  document.getElementById("gth-close").onclick = () => overlay.remove();

  wireReplacementTagSelector("gth-modal-replace-tag");
  document.getElementById("gth-replace-toggle").onchange = e => {
    replaceWithStraight = e.target.checked; savePreferences(); applyHiding();
    if (replaceWithStraight) warmFetchCache();
    const opts = document.getElementById("gth-modal-replace-tag-opts");
    if (opts) opts.style.display = replaceWithStraight ? "" : "none";
    const s = document.getElementById("gth-s-replace"); if (s) s.checked = replaceWithStraight;
  };
  document.getElementById("gth-female-performers-toggle").onchange = async e => {
    hideFemalePerformers = e.target.checked; savePreferences();
    if (hideFemalePerformers && femalePerformerIds.size === 0) await loadFemalePerformers();
    applyHiding();
    const s = document.getElementById("gth-s-female-performers"); if (s) s.checked = hideFemalePerformers;
  };
  document.getElementById("gth-fab-toggle").onchange = e => {
    showFAB = e.target.checked; savePreferences();
    if (showFAB) injectFAB(); else document.getElementById("gth-fab")?.remove();
    const s = document.getElementById("gth-s-fab"); if (s) s.checked = showFAB;
  };

  const allTags = [...allTagsMap.entries()].map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const searchInput = document.getElementById("gth-search");

  function renderLists(filter = "") {
    const lower = filter.toLowerCase().trim();
    document.getElementById("gth-hidden-count").textContent = hiddenTagIds.size;

    const availableList = document.getElementById("gth-available");
    availableList.innerHTML = "";
    allTags.filter(t => !hiddenTagIds.has(t.id) && t.name.toLowerCase().includes(lower))
      .forEach(tag => {
        const div = document.createElement("div");
        div.className = "gth-list-item";
        div.textContent = `☐ ${tag.name}`;
        div.onclick = () => {
          hiddenTagIds.add(tag.id); saveHiddenTags();
          renderLists(searchInput.value); applyHiding();
        };
        availableList.appendChild(div);
      });

    const hiddenList = document.getElementById("gth-hidden-list");
    hiddenList.innerHTML = "";
    allTags.filter(t => hiddenTagIds.has(t.id) && t.name.toLowerCase().includes(lower))
      .forEach(tag => {
        const div = document.createElement("div");
        div.className = "gth-list-item gth-hidden-item";
        div.innerHTML = `<span>${tag.name}</span><button class="gth-unhide-btn">Unhide</button>`;
        div.querySelector("button").onclick = e => {
          e.stopPropagation(); hiddenTagIds.delete(tag.id); saveHiddenTags();
          renderLists(searchInput.value); applyHiding();
        };
        hiddenList.appendChild(div);
      });
  }

  renderLists();
  searchInput.addEventListener("input", () => renderLists(searchInput.value));

  document.getElementById("gth-apply-defaults").onclick = async () => {
    if (!confirm("Apply Gay Defaults?\nThis will hide common female tags. Manually hidden tags will remain.")) return;
    let added = 0;
    for (const name of DEFAULT_HIDDEN_TAGS) {
      const id = tagNameToId.get(name.toLowerCase());
      if (id && !hiddenTagIds.has(id)) { hiddenTagIds.add(id); added++; }
    }
    saveHiddenTags(); applyHiding(); renderLists(searchInput.value);
    alert(added > 0 ? `Added ${added} default tags to the hidden list.`
      : "All default tags were already hidden (or not found in your Stash).");
  };

  document.getElementById("gth-unhide-all").onclick = () => {
    if (!confirm("Unhide ALL hidden tags?")) return;
    hiddenTagIds.clear(); saveHiddenTags(); renderLists(searchInput.value); applyHiding();
  };
}

// ---- Navigation ----

function onNavigation() {
  document.getElementById("gth-tags-btn")?.remove();
  document.getElementById("gth-tags-btn-wrapper")?.remove();
  // Only remove the settings panel when navigating away from the settings page.
  // Stash re-uses the same URL prefix for all settings sub-tabs, so if we're still
  // on a settings page the panel should stay (the MutationObserver keeps it alive).
  injectSettingsPanel._retrying = false;
  if (!isSettingsPage()) {
    document.getElementById("gth-settings-panel")?.remove();
  }
  setTimeout(() => { applyHiding(); injectTagsPageButton(); injectSettingsPanel(); }, 600);
}

// ---- GraphQL fetch interceptor ----
//
// Intercepts Stash's tag-search GraphQL requests so that hidden tags are
// removed at the data level and ONE replacement option is injected in their
// place.  This means:
//   • Typing "Pussy" in the tags dropdown  → ONE "Straight Studs Fucking" option
//   • No hidden tag names leak through into the search results
//
// The replacement option is a copy of the first hidden tag found (all server
// fields preserved, only the name overwritten) so Stash's code never hits
// undefined on missing properties.  Selecting it saves the backing tag to the
// scene; the UI then displays it as the replacement label everywhere.

// ---- Fetch-cache warm-up ----
//
// Fetches a full tag object for one of the hidden tags so that the replacement
// option can be injected even when the user types the replacement label before
// ever interacting with the dropdown.
//
// Uses _origFetch (pre-interceptor) to bypass our own fetch interceptor — this
// prevents the passive-cache block from poisoning _cachedHiddenTagObj with a
// response that has a different field set than Stash's dropdown query.
//
// Requests BOTH scalar counts (parent_count, child_count) AND relation arrays
// (parents, children) so the cached object works regardless of which form
// Stash's internal code accesses.
// Build a safe fallback object for the replacement option when no real
// server-returned object is available yet.  All potential array fields are
// initialised to [] so Stash never crashes with "Cannot read properties of
// undefined (reading 'length')" on aliases / parents / children.
function makeSafeReplacementObj(id) {
  return {
    __typename: "Tag",
    id: String(id),
    name: replacementTagName,
    aliases: [],
    description: null,
    ignore_auto_tag: false,
    image_path: null,
    scene_count: 0,
    marker_count: 0,
    image_count: 0,
    gallery_count: 0,
    performer_count: 0,
    parent_count: 0,
    child_count: 0,
    parents: [],
    children: [],
  };
}

async function warmFetchCache() {
  if (!replaceWithStraight || hiddenTagIds.size === 0) return;
  if (!_origFetch) return;

  // Phase 1 — find a representative hidden tag object (provides the field shape for
  // injection — aliases, parents, children, image_path, etc.).  Skipped if already set.
  // Tries up to 10 candidates and picks the first with scene_count > 0 so that the
  // replacement card on the Tags page doesn't initially show "0 Scenes".
  if (!_cachedHiddenTagObj) {
    // Set a synthetic fallback immediately so the active-injection path never waits
    // on network round-trips before it can operate.  The real object replaces this
    // once the async fetch below completes.
    const firstId = [...hiddenTagIds][0];
    if (firstId) _cachedHiddenTagObj = makeSafeReplacementObj(firstId);

    const candidates = [];
    for (const id of hiddenTagIds) {
      const n = allTagsMap.get(String(id));
      if (n) { candidates.push({ id, name: n }); }
      if (candidates.length >= 10) break;
    }
    if (candidates.length > 0) {
      const gql = `
        query GTHWarmCache($q: String) {
          findTags(filter: { q: $q, per_page: 10 }) {
            tags {
              id name aliases image_path
              scene_count parent_count child_count
              parents { id name }
              children { id name }
            }
          }
        }
      `;
      // Use _origFetch to bypass our own interceptor — prevents passive-cache
      // poisoning with a response that has a different field set.
      let firstMatch = null;
      for (const { id: warmId, name: warmName } of candidates) {
        try {
          const resp = await _origFetch("/graphql", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: gql, variables: { q: warmName } })
          });
          const json = await resp.json();
          const tags = json?.data?.findTags?.tags;
          if (Array.isArray(tags)) {
            const match = tags.find(t => hiddenTagIds.has(String(t.id)));
            if (match) {
              if (match.scene_count > 0) { _cachedHiddenTagObj = match; break; }
              if (!firstMatch) firstMatch = match;
            }
          }
        } catch (e) {
          console.warn("[GlobalTagHider] warmFetchCache attempt failed:", e);
        }
      }
      if (!_cachedHiddenTagObj) {
        _cachedHiddenTagObj = firstMatch || makeSafeReplacementObj(candidates[0].id);
      }
    }
  }

  // Phase 2 — total scene count across ALL hidden tags combined.  This is what the
  // replacement tag card shows on the Tags page and what findScenes expansion returns.
  if (_totalHiddenSceneCount === null) {
    try {
      const idList = [...hiddenTagIds].map(id => `"${String(id)}"`).join(",");
      const cr = await _origFetch("/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `query GTHCount {
            findScenes(
              scene_filter: { tags: { value: [${idList}], modifier: INCLUDES } }
              filter: { per_page: 0 }
            ) { count }
          }`
        })
      });
      const cj = await cr.json();
      const total = cj?.data?.findScenes?.count;
      if (typeof total === "number") _totalHiddenSceneCount = total;
    } catch (e) {
      console.warn("[GlobalTagHider] scene count fetch failed:", e);
    }
  }
}

function installFetchInterceptor() {
  if (window._gthFetchInstalled) return;
  window._gthFetchInstalled = true;

  _origFetch = window.fetch;
  const origFetch = _origFetch;
  window.fetch = async function(resource, options) {
    // Fast-path: not a GraphQL POST
    const url = typeof resource === "string" ? resource
      : (resource instanceof Request ? resource.url : "");
    if (!url.includes("/graphql") || !options?.body) {
      return origFetch.apply(this, arguments);
    }

    // Only intercept when replace-mode is on and there are hidden tags
    if (!replaceWithStraight || hiddenTagIds.size === 0) {
      return origFetch.apply(this, arguments);
    }

    // Parse the request body
    let body;
    try { body = JSON.parse(typeof options.body === "string" ? options.body : null); }
    catch { return origFetch.apply(this, arguments); }

    // --- findTag: fix name + scene_count on the tag detail page ---
    // The tag detail page fetches findTag(id) for its header stats.  Without this,
    // the stat block would show the real tag name and one tag's scene_count.
    if (/\bfindTag\b/.test(body?.query ?? "")) {
      const resp = await origFetch.apply(this, arguments);
      let json; try { json = await resp.json(); } catch { return resp; }
      const tag = json?.data?.findTag;
      if (tag && hiddenTagIds.has(String(tag.id))) {
        tag.name = replacementTagName;
        if (_totalHiddenSceneCount !== null) tag.scene_count = _totalHiddenSceneCount;
        return new Response(JSON.stringify(json), {
          status: resp.status, headers: { "content-type": "application/json" }
        });
      }
      return new Response(JSON.stringify(json), {
        status: resp.status, headers: { "content-type": "application/json" }
      });
    }

    // --- findScenes: expand a hidden-tag filter to ALL hidden tags ---
    // When Stash queries scenes for one hidden tag (e.g. the replacement card's ID),
    // rewrite the filter to include every hidden tag with INCLUDES so the user sees
    // all "Straight Studs Fucking" scenes, not just the one tag's scenes.
    // Only rewrite when every ID in the filter is a hidden tag (avoids touching
    // mixed filters that the user set up themselves with non-hidden tags).
    // Handles both snake_case (scene_filter) and camelCase (sceneFilter) variable names.
    if (/\bfindScenes\b/.test(body?.query ?? "")) {
      const sfKey = body?.variables?.scene_filter  ? "scene_filter"
                  : body?.variables?.sceneFilter   ? "sceneFilter"
                  : null;
      const sf = sfKey && body.variables[sfKey];
      const tf = sf?.tags;
      if (tf && Array.isArray(tf.value) && tf.value.length > 0 &&
          tf.value.every(id => hiddenTagIds.has(String(id)))) {
        const expanded = {
          ...body,
          variables: {
            ...body.variables,
            [sfKey]: { ...sf, tags: { value: [...hiddenTagIds], modifier: "INCLUDES" } },
          },
        };
        return origFetch.call(this, resource, { ...options, body: JSON.stringify(expanded) });
      }
    }

    // Must be a findTags query with a text search term.
    // Accept two variable paths:
    //   filter.q          — scene-tag dropdown (react-select autocomplete)
    //   tagFilter.name.value — Tags navigation page search bar
    // Non-search findTags (loadAllTags, sort/pagination without a term) must
    // pass through completely unmodified — body not consumed, all headers intact.
    const filterQ       = body?.variables?.filter?.q?.trim();
    const tagFilterName = body?.variables?.tagFilter?.name?.value?.trim();
    const searchTerm    = filterQ || tagFilterName;

    if (!/\bfindTags\b/.test(body?.query ?? "") || !searchTerm) {
      return origFetch.apply(this, arguments);
    }

    // From here we know this is a user-typed tag search.
    const resp = await origFetch.apply(this, arguments);
    let json;
    try { json = await resp.json(); }
    catch { return resp; }

    const tags = json?.data?.findTags?.tags;
    if (!Array.isArray(tags)) {
      return new Response(JSON.stringify(json), { status: resp.status, headers: { "content-type": "application/json" } });
    }

    // Partition results
    const visible = tags.filter(t => !hiddenTagIds.has(String(t.id)));
    const hidden  = tags.filter(t =>  hiddenTagIds.has(String(t.id)));

    // Helper: build the replacement object, overriding name and scene_count.
    // scene_count uses the aggregate total across all hidden tags (if known) so the
    // card on the Tags page shows the correct combined count rather than one tag's count.
    const makeReplacement = src => ({
      ...src,
      name: replacementTagName,
      scene_count: _totalHiddenSceneCount ?? src.scene_count,
    });

    if (hidden.length > 0) {
      // Cache the full dropdown-field object for later label-prefix injection
      _cachedHiddenTagObj = hidden[0];
      // Inject ONE replacement option (spread full object to preserve all Stash fields)
      if (!visible.some(t => t.name === replacementTagName)) {
        visible.push(makeReplacement(hidden[0]));
      }
    } else {
      // User is typing the replacement label — inject from cache when any word prefix matches.
      // Word-boundary matching ("Stud" finds "Straight Studs Fucking"; pure startsWith would miss).
      const lowerSearch = searchTerm.toLowerCase();
      const words = replacementTagName.toLowerCase().split(/\s+/);
      const wordPrefixMatch = lowerSearch.length >= 2 &&
        words.some(w => w.startsWith(lowerSearch));
      if (
        wordPrefixMatch &&
        _cachedHiddenTagObj &&
        !visible.some(t => t.name === replacementTagName)
      ) {
        visible.push(makeReplacement(_cachedHiddenTagObj));
      }
    }

    json.data.findTags.tags = visible;
    // Keep count consistent with the filtered+injected result set.
    if (typeof json.data.findTags.count === "number") {
      json.data.findTags.count = visible.length;
    }

    return new Response(JSON.stringify(json), {
      status: resp.status,
      headers: { "content-type": "application/json" },
    });
  };
}

// ---- Init ----

async function init() {
  console.log("[GlobalTagHider] Starting...");
  loadHiddenTags(); loadPreferences();

  installFetchInterceptor();

  const tagsPromise = loadAllTags().then(async () => { await ensureDefaults(); });
  const perfPromise = hideFemalePerformers ? loadFemalePerformers() : Promise.resolve();

  // Pre-warm the fetch cache so the replacement label is searchable immediately
  tagsPromise.then(() => warmFetchCache());

  Promise.all([tagsPromise, perfPromise]).then(() => applyHiding());

  injectFAB();
  injectTagsPageButton();
  injectSettingsPanel();

  if (hideObserver) hideObserver.disconnect();
  hideObserver = new MutationObserver(onDOMChange);
  hideObserver.observe(document.body, { childList: true, subtree: true });

  if (window.PluginApi?.Event) {
    PluginApi.Event.addEventListener("stash:location", onNavigation);
  }
  window.addEventListener("hashchange", onNavigation);
  window.addEventListener("popstate",   onNavigation);

  console.log("[GlobalTagHider] Ready.");
}

// ---- Bootstrap ----

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
