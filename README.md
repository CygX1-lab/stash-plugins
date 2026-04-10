# 🌈 Global Tag Hider – Gay Edition (Stash Plugin)

A powerful **Stash plugin** that lets you globally hide unwanted tags and female performers across the entire UI — with a clean modal interface and smart defaults built for gay / male-focused libraries.

---

## ✨ Features

- 🙈 **Hide tags globally** — tags disappear from dropdowns, lists, and selection components everywhere
- 👤 **Hide female performers everywhere** — performer cards, thumbnails, and links for any performer with gender set to Female are removed across all pages (Performers, Scenes, Scene detail)
- 🔄 **Replace with "Straight"** — instead of hiding, female tags can be relabelled as "Straight" for easy straight-scene filtering
- 🌈 **Gay Defaults** — one-click preset that hides 50+ common female tags on first run
- 🔍 **Searchable tag management UI** — quickly find and hide / unhide any tag
- ⚙️ **Settings panel** — preferences live under Settings → Plugins → Global Tag Hider (no button needed)
- 🎛️ **Tags page toolbar button** — quick access from the Tags list page
- 🙈 **Optional floating button** — toggle the FAB on/off from settings
- 💾 **Persistent** — settings survive page refreshes via localStorage
- ⚡ **Live DOM updates** — no page refresh needed

---

## 📦 Installation

### 1. Add Plugin Repository

1. In Stash: **Settings → Plugins → Add Source**
2. Enter: `https://raw.githubusercontent.com/CygX1-lab/stash-plugins/main/index.yml`

### 2. Install Plugin

- Find **Global Tag Hider – Gay Edition** in the Available Plugins list
- Click **Install**

---

## 🛠 Manual Installation

1. Download `global-tag-hider.zip`
2. Extract into your Stash plugins directory: `<stash_data>/plugins/global-tag-hider/`
3. Restart Stash

---

## 🧠 How It Works

- Loads all tags via GraphQL (`findTags`) and female performers via `findPerformers` on startup
- Watches for DOM changes with a `MutationObserver` and re-applies hiding after every React re-render
- Hides content by matching tag IDs from `href` attributes and performer IDs from performer links
- Matches react-select dropdown options and selected chips by tag name
- Settings are stored in `localStorage` — no Stash database changes, purely UI-level

---

## 🌈 Gay Defaults

On first run the plugin automatically hides 50+ common female-related tags, including:

- Tits / Boobs / Pussy (all variants)
- Cowgirl / Reverse Cowgirl / Vaginal sex acts
- Lesbian / Girl on Girl / Female Masturbation / Strap-on
- Female age/body descriptors (MILF, Schoolgirl, Short/Tall/Athletic Woman, …)
- Hair colour tags (Female) — Blonde, Black, Brown, Red
- Solo Female / Transgender (Female)

You can reapply defaults at any time or fully customise the hidden list from the modal.

---

## ⚙️ Preferences

All preferences are available in **Settings → Plugins → Global Tag Hider** and also inside the modal:

| Setting | Description |
|---|---|
| Replace hidden tags with "Straight" | Relabels female tags as "Straight" instead of hiding them |
| Hide female performers everywhere | Removes female performer cards and links across all pages |
| Show floating 🙈 button | Toggle the FAB; use the Tags toolbar button or Settings panel to re-enable |

---

## 🎮 Usage

- **Settings → Plugins → Global Tag Hider** — adjust preferences without opening the modal
- **Tags page toolbar** — "Tag Hider" button appears in the toolbar on the Tags page
- **Floating button (🙈)** — click from any page to open the full tag management modal

### Inside the modal:

- Click any available tag → hides it immediately
- Click **Unhide** next to a hidden tag → restores it
- Use the search box to filter tags
- **Apply Gay Defaults** — re-applies the built-in female tag preset
- **Unhide All** — clears the entire hidden list

---

## ⚠️ Notes

- Tag and performer hiding is **UI-only** — nothing in the Stash database is modified
- Works best with up-to-date Stash versions
- Requires the Stash plugin system to be enabled

---

## 🔧 Plugin Structure

```
global-tag-hider/
├── global-tag-hider.yml   # plugin manifest
├── global-tag-hider.js    # all plugin logic
└── global-tag-hider.css   # modal and list styling
```

---

## 📜 License

MIT

---

## ❤️ Credits

Built for the Stash community — for cleaner, focused, male/gay libraries.
