// =============================================
// Global Tag Hider - GAY EDITION
// Separate CSS file + beautiful modal
// =============================================

const PLUGIN_ID = "global-tag-hider";
const STORAGE_KEY = "hiddenTagIds";
const GAY_DEFAULT_APPLIED_KEY = "gayDefaultsApplied";

let hiddenTagIds = [];

// Common female tags hidden by default in Gay Edition
const GAY_DEFAULT_TAGS = [
  "tits", "big tits", "small tits", "natural tits", "fake tits", "huge tits",
"boobs", "cleavage", "nipples", "pussy", "wet pussy", "shaved pussy",
"hairy pussy", "creampie", "internal creampie", "cum on pussy",
"pussy licking", "cunnilingus", "lesbian", "lesbian kissing", "girl on girl",
"ff", "female masturbation", "dildo", "vibrator", "squirt", "tribbing",
"scissoring", "strap on", "milf", "teen", "young girl", "bubble butt"
];

async function loadHiddenTags() {
  try {
    const stored = await PluginApi.getPluginSetting(PLUGIN_ID, STORAGE_KEY);
    hiddenTagIds = stored ? JSON.parse(stored) : [];
  } catch (e) {
    hiddenTagIds = [];
  }
}

async function saveHiddenTags() {
  try {
    await PluginApi.setPluginSetting(PLUGIN_ID, STORAGE_KEY, JSON.stringify(hiddenTagIds));
  } catch (e) {
    console.error("[GlobalTagHider] Save failed:", e);
  }
}

async function ensureGayDefaults() {
  try {
    const applied = await PluginApi.getPluginSetting(PLUGIN_ID, GAY_DEFAULT_APPLIED_KEY);
    if (applied === "true") return;

    await loadHiddenTags();
    let added = 0;

    for (const name of GAY_DEFAULT_TAGS) {
      const result = await PluginApi.callGQL(`
      query FindTag($name: String!) {
        findTagByName(name: $name) { id }
      }
      `, { name });

      const tag = result.data?.findTagByName;
      if (tag && !hiddenTagIds.includes(parseInt(tag.id))) {
        hiddenTagIds.push(parseInt(tag.id));
        added++;
      }
    }

    if (added > 0) {
      await saveHiddenTags();
      console.log(`[GlobalTagHider Gay] Applied defaults: hid ${added} female tags`);
    }

    await PluginApi.setPluginSetting(PLUGIN_ID, GAY_DEFAULT_APPLIED_KEY, "true");
  } catch (e) {
    console.warn("[GlobalTagHider] Could not apply gay defaults:", e);
  }
}

function shouldHideTag(tag) {
  return tag && tag.id && hiddenTagIds.includes(parseInt(tag.id));
}

function applyHidingPatches() {
  const observer = new MutationObserver(() => {
    document.querySelectorAll('.tag, .react-select__option, .tag-select-option, [data-tag-id], [data-id]').forEach(el => {
      const tagId = el.dataset.tagId || el.getAttribute('data-id');
      if (tagId && shouldHideTag({ id: tagId })) {
        el.style.display = 'none';
      }
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });

  setTimeout(() => {
    document.querySelectorAll('.tag, .react-select__option').forEach(el => {
      const tagId = el.dataset.tagId || el.getAttribute('data-id');
      if (tagId && shouldHideTag({ id: tagId })) el.style.display = 'none';
    });
  }, 600);
}

async function showHideTagsModal() {
  await loadHiddenTags();

  const modalHTML = `
  <div style="padding: 24px;">
  <input type="text" id="gth-search" class="gth-search" placeholder="🔍 Search tags...">

  <button id="gth-apply-defaults" class="gth-default-btn">
  🌈 Apply Gay Defaults (hide common female tags)
  </button>

  <div style="color:#a5a5d0; margin-bottom:8px;">Available Tags — click to hide</div>
  <div id="gth-available" class="gth-list"></div>

  <div style="color:#a5a5d0; margin:20px 0 8px;">Hidden Tags (${hiddenTagIds.length})</div>
  <div id="gth-hidden" class="gth-list"></div>

  <div style="margin-top:28px; text-align:right;">
  <button id="gth-unhide-all" style="background:#ef4444; color:white; border:none; padding:10px 20px; border-radius:9999px; cursor:pointer;">Unhide All</button>
  </div>
  </div>
  `;

  const modal = PluginApi.createDialog({
    title: "🙈 Global Tag Hider — Gay Edition",
    content: modalHTML,
    className: "gth-modal",
    buttons: [{ text: "Close", onclick: () => modal.close() }]
  });

  setTimeout(() => {
    const searchInput = document.getElementById("gth-search");
    const availableList = document.getElementById("gth-available");
    const hiddenList = document.getElementById("gth-hidden");

    PluginApi.callGQL(`query AllTags { allTags { id name } }`).then(result => {
      const allTags = result.data?.allTags || [];
      renderLists(allTags, searchInput.value);

      searchInput.addEventListener("input", () => renderLists(allTags, searchInput.value));
    });

    function renderLists(allTags, filter = "") {
      const lower = filter.toLowerCase().trim();

      // Available
      availableList.innerHTML = "";
      allTags
      .filter(t => !hiddenTagIds.includes(parseInt(t.id)) && t.name.toLowerCase().includes(lower))
      .sort((a,b) => a.name.localeCompare(b.name))
      .forEach(tag => {
        const div = document.createElement("div");
        div.className = "gth-list-item";
        div.innerHTML = `☐ ${tag.name}`;
        div.onclick = async () => {
          hiddenTagIds.push(parseInt(tag.id));
          await saveHiddenTags();
          renderLists(allTags, searchInput.value);
          applyHidingPatches();
        };
        availableList.appendChild(div);
      });

      // Hidden
      hiddenList.innerHTML = "";
      allTags
      .filter(t => hiddenTagIds.includes(parseInt(t.id)) && t.name.toLowerCase().includes(lower))
      .sort((a,b) => a.name.localeCompare(b.name))
      .forEach(tag => {
        const div = document.createElement("div");
        div.className = "gth-list-item gth-hidden-item";
        div.innerHTML = `<span>${tag.name}</span><button class="gth-unhide-btn">Unhide</button>`;
        div.querySelector("button").onclick = async (e) => {
          e.stopPropagation();
          hiddenTagIds = hiddenTagIds.filter(id => id !== parseInt(tag.id));
          await saveHiddenTags();
          renderLists(allTags, searchInput.value);
          applyHidingPatches();
        };
        hiddenList.appendChild(div);
      });
    }

    // Apply Gay Defaults
    document.getElementById("gth-apply-defaults").onclick = async () => {
      if (!confirm("Apply Gay Defaults?\nThis will hide common female tags.\nYour manually hidden tags will remain.")) return;

      let added = 0;
      for (const name of GAY_DEFAULT_TAGS) {
        const result = await PluginApi.callGQL(`query FindTag($name: String!) { findTagByName(name: $name) { id } }`, { name });
        const tag = result.data?.findTagByName;
        if (tag && !hiddenTagIds.includes(parseInt(tag.id))) {
          hiddenTagIds.push(parseInt(tag.id));
          added++;
        }
      }

      if (added > 0) {
        await saveHiddenTags();
        renderLists((await PluginApi.callGQL(`query AllTags { allTags { id name } }`)).data.allTags, searchInput.value);
        applyHidingPatches();
        alert(`Successfully added ${added} default female tags to the hidden list.`);
      } else {
        alert("All default female tags were already hidden.");
      }
    };

    document.getElementById("gth-unhide-all").onclick = async () => {
      if (confirm("Unhide ALL hidden tags?")) {
        hiddenTagIds = [];
        await saveHiddenTags();
        renderLists((await PluginApi.callGQL(`query AllTags { allTags { id name } }`)).data.allTags, searchInput.value);
        applyHidingPatches();
      }
    };
  }, 100);
}

// UI Injection
function injectUI() {
  const addButton = () => {
    document.querySelectorAll('.toolbar, .filter-toolbar, [role="toolbar"]').forEach(toolbar => {
      if (toolbar.querySelector("#gth-hide-btn")) return;
      const btn = document.createElement("button");
      btn.id = "gth-hide-btn";
      btn.className = "btn btn-secondary";
      btn.innerHTML = `🙈 Hide Tags`;
      btn.title = "Global Tag Hider — Gay Edition";
      btn.style.marginLeft = "12px";
      btn.onclick = showHideTagsModal;
      toolbar.appendChild(btn);
    });
  };

  addButton();
  new MutationObserver(addButton).observe(document.body, { childList: true, subtree: true });

  if (typeof PluginApi.registerMenuItem === "function") {
    PluginApi.registerMenuItem({
      id: PLUGIN_ID,
      label: "Global Tag Hider (Gay)",
                               icon: "🙈",
                               onclick: showHideTagsModal
    });
  }
}

// Initialize
async function init() {
  console.log("🚀 Global Tag Hider — Gay Edition starting...");
  await loadHiddenTags();
  await ensureGayDefaults();
  applyHidingPatches();
  injectUI();

  window.addEventListener("hashchange", () => setTimeout(applyHidingPatches, 700));

  console.log("✅ Gay Edition is ready. Common female tags are hidden by default.");
}

if (typeof PluginApi !== "undefined") {
  PluginApi.on("loaded", init);
} else {
  window.addEventListener("load", init);
}
