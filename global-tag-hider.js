// =============================================
// Global Tag Hider - Gay Edition
// =============================================

const STORAGE_KEY               = "gth_hiddenTagIds";
const DEFAULTS_APPLIED_KEY      = "gth_defaultsApplied";
const REPLACE_KEY               = "gth_replaceWithStraight";
const SHOW_FAB_KEY              = "gth_showFAB";
const HIDE_FEMALE_PERFORMERS_KEY = "gth_hideFemalePerformers";

let hiddenTagIds          = new Set();
let femalePerformerIds    = new Set();
let allTagsMap            = new Map();
let tagNameToId           = new Map();
let replaceWithStraight   = false;
let showFAB               = true;
let hideFemalePerformers  = false;
let hideObserver          = null;

const DEFAULT_HIDDEN_TAGS = [
  "Tits", "Big Tits", "Small Tits", "Natural Tits", "Fake Tits", "Huge Tits", "Medium Tits",
  "Cum on Tits", "Tit Worship", "Titjob", "Titty Fuck",
  "Boobs", "Cleavage",
  "Pussy", "Wet Pussy", "Shaved Pussy", "Hairy Pussy", "Hairless Pussy", "Trimmed Pussy",
  "Innie Pussy", "Outie Pussy", "Cum on Pussy",
  "Pussy Licking", "Pussy Fingering", "Pussy Rubbing", "Pussy Gape", "Cunnilingus",
  "Cowgirl", "Reverse Cowgirl", "Anal Cowgirl", "Anal Reverse Cowgirl",
  "Lesbian", "Lesbian Kissing", "Girl on Girl",
  "FF", "Female Masturbation", "Squirt", "Tribbing", "Scissoring", "Strap-on",
  "MILF", "Young Girl", "Schoolgirl", "Teen Girl (18\u201322)",
  "Girlfriend", "Other Person's Girlfriend", "For Girls",
  "Young Woman (22-30)", "Young Woman (22\u201330)", "Woman 30-39",
  "Short Woman", "Average Height Woman", "Tall Woman",
  "White Woman", "Latin Woman", "Latina Woman", "Athletic Woman",
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
  showFAB              = localStorage.getItem(SHOW_FAB_KEY)               !== "false";
  hideFemalePerformers = localStorage.getItem(HIDE_FEMALE_PERFORMERS_KEY) === "true";
}

function savePreferences() {
  localStorage.setItem(REPLACE_KEY,                String(replaceWithStraight));
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

  // --- Tag cards (matched by tag ID in href) ---
  let straightCardDone = false;
  document.querySelectorAll('a[href*="/tags/"]').forEach(link => {
    const match = link.getAttribute("href").match(/\/tags\/(\d+)/);
    if (!match || !hiddenTagIds.has(match[1])) return;
    const container =
      link.closest(".card, .tag-card, li, [class*='col']") || findContainer(link);

    if (replaceWithStraight && !straightCardDone) {
      const heading = container.querySelector(
        "h5, h4, h3, h2, [class*='title'], [class*='Title']"
      );
      if (heading && heading.textContent !== "Straight") heading.textContent = "Straight";
      container.style.display = "";
      straightCardDone = true;
    } else {
      container.style.display = "none";
    }
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
  let straightOptionDone = false;
  document.querySelectorAll(".react-select__option").forEach(el => {
    if (!hiddenNames.has(el.textContent.trim().toLowerCase())) return;
    if (replaceWithStraight && !straightOptionDone) {
      if (el.textContent.trim() !== "Straight") el.textContent = "Straight";
      el.style.display = ""; straightOptionDone = true;
    } else { el.style.display = "none"; }
  });

  // --- Selected tag chips ---
  document.querySelectorAll(".react-select__multi-value").forEach(el => {
    const label = el.querySelector(".react-select__multi-value__label");
    if (!label || !hiddenNames.has(label.textContent.trim().toLowerCase())) return;
    if (replaceWithStraight) {
      if (label.textContent !== "Straight") label.textContent = "Straight";
      el.style.display = "";
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

// ---- Settings page panel ----

function isSettingsPage() {
  const url = window.location.pathname + window.location.search + window.location.hash;
  return url.toLowerCase().includes("settings");
}

function findPluginCard() {
  // "Global Tag Hider" text appears in multiple sections:
  //   • Plugins          — loaded plugin entries; THIS is where we want our panel
  //   • Available Plugins — package registry rows (have Install / Update buttons)
  //   • Installed Plugins — installed package rows (have Uninstall buttons)
  //
  // We collect all candidate card elements, then pick the one that does NOT
  // carry any install/update/uninstall actions — that is the running-plugin entry.

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

  // Prefer a card that has NO install / update / uninstall buttons —
  // those belong to the Available/Installed Plugins sections, not to us.
  for (const card of candidates) {
    const hasPackageAction = [...card.querySelectorAll("button, a[role='button']")]
      .some(b => /\b(install|update|uninstall)\b/i.test(b.textContent.trim()));
    if (!hasPackageAction) return card;
  }

  // All candidates have package buttons — last resort, return the first
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
        <div>
          <div style="color:#e0e0ff;font-weight:500;">Replace hidden tags with "Straight"</div>
          <div style="color:#888;font-size:0.82rem;margin-top:3px;">
            Instead of hiding, female tags appear as "Straight".
          </div>
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

  document.getElementById("gth-s-replace").onchange = e => {
    replaceWithStraight = e.target.checked; savePreferences(); applyHiding();
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
            <div>
              <div style="color:#e0e0ff;font-weight:500;">Replace hidden tags with "Straight"</div>
              <div style="color:#a5a5d0;font-size:0.85rem;margin-top:4px;">
                Instead of hiding, female tags appear as "Straight" — easy to spot and filter
                straight scenes while keeping male performers in focus.
              </div>
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

  document.getElementById("gth-replace-toggle").onchange = e => {
    replaceWithStraight = e.target.checked; savePreferences(); applyHiding();
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

// ---- Init ----

async function init() {
  console.log("[GlobalTagHider] Starting...");
  loadHiddenTags(); loadPreferences();

  const tagsPromise = loadAllTags().then(async () => { await ensureDefaults(); });
  const perfPromise = hideFemalePerformers ? loadFemalePerformers() : Promise.resolve();

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
