// =============================================
// Global Tag Hider - Gay Edition
// =============================================

const STORAGE_KEY = "gth_hiddenTagIds";
const DEFAULTS_APPLIED_KEY = "gth_defaultsApplied";

let hiddenTagIds = new Set(); // string IDs
let allTagsMap = new Map();   // id (string) -> name
let tagNameToId = new Map();  // lowercase name -> id (string)
let hideObserver = null;

// Default tags to hide on first run (case-insensitive matching against your Stash tags)
const DEFAULT_HIDDEN_TAGS = [
  // Tits
  "Tits", "Big Tits", "Small Tits", "Natural Tits", "Fake Tits", "Huge Tits", "Medium Tits",
  "Cum on Tits", "Tit Worship", "Titjob", "Titty Fuck",
  // Boobs / chest
  "Boobs", "Cleavage", "Nipples",
  // Pussy variants
  "Pussy", "Wet Pussy", "Shaved Pussy", "Hairy Pussy", "Hairless Pussy", "Trimmed Pussy",
  "Innie Pussy", "Outie Pussy", "Cum on Pussy",
  "Pussy Licking", "Pussy Fingering", "Pussy Rubbing", "Pussy Gape", "Cunnilingus",
  // Cowgirl positions
  "Cowgirl", "Reverse Cowgirl", "Anal Cowgirl", "Anal Reverse Cowgirl",
  // Lesbian / female-focused
  "Lesbian", "Lesbian Kissing", "Girl on Girl",
  "FF", "Female Masturbation", "Squirt", "Tribbing", "Scissoring", "Strap-on",
  // Female archetypes / misc
  "MILF", "Young Girl", "Schoolgirl", "Teen Girl (18\u201322)",
  "Girlfriend", "Other Person's Girlfriend", "For Girls",
];

// ---- Storage (localStorage) ----

function loadHiddenTags() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    hiddenTagIds = new Set(stored ? JSON.parse(stored) : []);
  } catch (e) {
    hiddenTagIds = new Set();
  }
}

function saveHiddenTags() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...hiddenTagIds]));
  } catch (e) {
    console.error("[GlobalTagHider] Save failed:", e);
  }
}

// ---- GraphQL (direct fetch) ----

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
      findTags(filter: { per_page: -1 }) {
        tags { id name }
      }
    }
  `);
  const tags = result.data?.findTags?.tags || [];
  allTagsMap = new Map(tags.map(t => [String(t.id), t.name]));
  tagNameToId = new Map(tags.map(t => [t.name.toLowerCase(), String(t.id)]));
  return tags;
}

// ---- Defaults ----

async function ensureDefaults() {
  // Re-apply defaults if the hidden list is empty, even if the flag is set.
  // This handles the case where a previous broken install set the flag without
  // actually hiding anything.
  const flagSet = localStorage.getItem(DEFAULTS_APPLIED_KEY) === "true";
  if (flagSet && hiddenTagIds.size > 0) return;

  if (allTagsMap.size === 0) await loadAllTags();

  let added = 0;
  for (const name of DEFAULT_HIDDEN_TAGS) {
    const id = tagNameToId.get(name.toLowerCase());
    if (id && !hiddenTagIds.has(id)) {
      hiddenTagIds.add(id);
      added++;
    }
  }

  if (added > 0) {
    saveHiddenTags();
    console.log(`[GlobalTagHider] Applied defaults: hid ${added} tags`);
  }

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

let hideScheduled = false;
function scheduleHiding() {
  if (hideScheduled) return;
  hideScheduled = true;
  setTimeout(() => {
    hideScheduled = false;
    applyHiding();
  }, 150);
}

function applyHiding() {
  if (hiddenTagIds.size === 0) return;
  const hiddenNames = getHiddenTagNames();

  // --- Tag cards on the /tags page ---
  // Match by tag ID extracted from the href ("/tags/123/scenes").
  // This is the most reliable method — no text-matching needed.
  document.querySelectorAll('a[href*="/tags/"]').forEach(link => {
    const match = link.getAttribute("href").match(/\/tags\/(\d+)/);
    if (!match) return;
    const tagId = match[1];
    if (hiddenTagIds.has(tagId)) {
      // Hide the card wrapper or the closest meaningful container
      const container = link.closest(".card, .tag-card, li, [class*='col-']") || link;
      container.style.display = "none";
    }
  });

  // --- react-select dropdown options (tag picker dropdowns) ---
  // These don't have hrefs, so match by name text.
  document.querySelectorAll(".react-select__option").forEach(el => {
    const text = el.textContent.trim().toLowerCase();
    el.style.display = hiddenNames.has(text) ? "none" : "";
  });

  // --- Selected tag chips inside a multi-select ---
  document.querySelectorAll(".react-select__multi-value").forEach(el => {
    const label = el.querySelector(".react-select__multi-value__label");
    if (label && hiddenNames.has(label.textContent.trim().toLowerCase())) {
      el.style.display = "none";
    }
  });
}

// ---- Modal ----

async function showModal() {
  loadHiddenTags();
  if (allTagsMap.size === 0) await loadAllTags();

  document.getElementById("gth-overlay")?.remove();

  const overlay = document.createElement("div");
  overlay.id = "gth-overlay";
  overlay.style.cssText =
    "position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;" +
    "display:flex;align-items:center;justify-content:center;";

  overlay.innerHTML = `
    <div class="gth-modal">
      <div style="display:flex;justify-content:space-between;align-items:center;
                  padding:20px 24px 14px;border-bottom:1px solid #4f46e5;">
        <h2 style="margin:0;color:#c4b5fd;">🙈 Global Tag Hider — Gay Edition</h2>
        <button id="gth-close"
          style="background:none;border:none;color:#e0e0ff;font-size:1.4rem;
                 cursor:pointer;line-height:1;padding:0 4px;">✕</button>
      </div>
      <div style="padding:24px;">
        <input type="text" id="gth-search" class="gth-search"
               placeholder="🔍 Search tags...">
        <button id="gth-apply-defaults" class="gth-default-btn">
          🌈 Apply Gay Defaults (hide common female tags)
        </button>
        <div style="color:#a5a5d0;margin-bottom:8px;">
          Available Tags — click to hide
        </div>
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

  const allTags = [...allTagsMap.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const searchInput = document.getElementById("gth-search");

  function renderLists(filter = "") {
    const lower = filter.toLowerCase().trim();
    document.getElementById("gth-hidden-count").textContent = hiddenTagIds.size;

    const availableList = document.getElementById("gth-available");
    availableList.innerHTML = "";
    allTags
      .filter(t => !hiddenTagIds.has(t.id) && t.name.toLowerCase().includes(lower))
      .forEach(tag => {
        const div = document.createElement("div");
        div.className = "gth-list-item";
        div.textContent = `☐ ${tag.name}`;
        div.onclick = () => {
          hiddenTagIds.add(tag.id);
          saveHiddenTags();
          renderLists(searchInput.value);
          applyHiding();
        };
        availableList.appendChild(div);
      });

    const hiddenList = document.getElementById("gth-hidden-list");
    hiddenList.innerHTML = "";
    allTags
      .filter(t => hiddenTagIds.has(t.id) && t.name.toLowerCase().includes(lower))
      .forEach(tag => {
        const div = document.createElement("div");
        div.className = "gth-list-item gth-hidden-item";
        div.innerHTML = `<span>${tag.name}</span><button class="gth-unhide-btn">Unhide</button>`;
        div.querySelector("button").onclick = e => {
          e.stopPropagation();
          hiddenTagIds.delete(tag.id);
          saveHiddenTags();
          renderLists(searchInput.value);
          applyHiding();
        };
        hiddenList.appendChild(div);
      });
  }

  renderLists();
  searchInput.addEventListener("input", () => renderLists(searchInput.value));

  document.getElementById("gth-apply-defaults").onclick = async () => {
    if (!confirm("Apply Gay Defaults?\nThis will hide common female tags. Your manually hidden tags will remain.")) return;
    let added = 0;
    for (const name of DEFAULT_HIDDEN_TAGS) {
      const id = tagNameToId.get(name.toLowerCase());
      if (id && !hiddenTagIds.has(id)) {
        hiddenTagIds.add(id);
        added++;
      }
    }
    saveHiddenTags();
    applyHiding();
    renderLists(searchInput.value);
    alert(added > 0
      ? `Added ${added} default tags to the hidden list.`
      : "All default tags were already hidden (or not found in your Stash).");
  };

  document.getElementById("gth-unhide-all").onclick = () => {
    if (!confirm("Unhide ALL hidden tags?")) return;
    hiddenTagIds.clear();
    saveHiddenTags();
    renderLists(searchInput.value);
    applyHiding();
  };
}

// ---- UI Injection ----

function injectFAB() {
  if (document.getElementById("gth-fab")) return;
  const fab = document.createElement("button");
  fab.id = "gth-fab";
  fab.innerHTML = "🙈";
  fab.title = "Global Tag Hider";
  fab.style.cssText =
    "position:fixed;bottom:24px;right:24px;width:56px;height:56px;" +
    "border-radius:50%;background:#7c3aed;border:none;font-size:1.5rem;" +
    "cursor:pointer;z-index:9000;box-shadow:0 4px 12px rgba(124,58,237,0.5);";
  fab.onclick = showModal;
  document.body.appendChild(fab);
}

// ---- Init ----

async function init() {
  console.log("[GlobalTagHider] Starting...");
  loadHiddenTags();

  // Load tags, apply defaults, then hide. FAB is injected immediately.
  loadAllTags().then(async () => {
    await ensureDefaults();
    applyHiding();
  });

  injectFAB();

  // Debounced observer for dynamic content (react-select dropdowns etc.)
  if (hideObserver) hideObserver.disconnect();
  hideObserver = new MutationObserver(scheduleHiding);
  hideObserver.observe(document.body, { childList: true, subtree: true });

  // Re-hide on SPA navigation
  if (window.PluginApi?.Event) {
    PluginApi.Event.addEventListener("stash:location", () => setTimeout(applyHiding, 500));
  }
  window.addEventListener("hashchange", () => setTimeout(applyHiding, 500));
  window.addEventListener("popstate", () => setTimeout(applyHiding, 500));

  console.log("[GlobalTagHider] Ready.");
}

// ---- Bootstrap ----
// Stash loads plugin scripts after the app is initialized, so PluginApi is
// available immediately. Call init() directly — no need to wait or listen for
// a "loaded" event that may have already fired.

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
