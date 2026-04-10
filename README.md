# stash-plugins

# 🌈 Global Tag Hider – Gay Edition (Stash Plugin)

A powerful **Stash plugin** that lets you globally hide unwanted tags across the UI — with a clean interface and smart defaults.

Designed especially for **gay / male-focused libraries**, this edition automatically hides common female-related tags on first run.

---

## ✨ Features

- 🙈 Hide tags globally (dropdowns, lists, selectors)
- 🔍 Searchable tag management UI
- 🎯 One-click hide/unhide
- 🌈 "Gay Defaults" — auto-hide common female tags
- 💾 Persistent storage using Stash plugin settings
- ⚡ Live DOM updates (no refresh needed)

---

## 📦 Installation

### 1. Add Plugin Repository

1. In Stash: Settings → Plugins → Add Source
2. Add: https://raw.githubusercontent.com/CygX1-lab/stash-plugins/main/index.yml


---

### 2. Install Plugin

- Find **Global Tag Hider – Gay Edition**
- Click **Install**

---

## 🛠 Manual Installation (Advanced)

1. Download the plugin `.zip`
2. Extract into your Stash plugins directory: <stash>/plugins/global-tag-hider/
3. Restart Stash

---

## 🧠 How It Works

- Uses `PluginApi` to fetch and store hidden tag IDs
- Hooks into UI rendering via `MutationObserver`
- Automatically hides matching tags across:
  - tag lists
  - dropdowns
  - selection components

---

## 🌈 Gay Defaults

On first run, the plugin will automatically hide common female-related tags such as:

- tits / boobs / pussy
- lesbian / girl-on-girl
- female-only categories

You can:
- reapply defaults anytime
- or fully customize your hidden list

---

## 🎮 Usage

- Click **🙈 Hide Tags** button in toolbar  
  **or**
- Use menu entry:  
  `Global Tag Hider (Gay)`

### Inside the UI:

- Click a tag → hide it
- Click "Unhide" → restore it
- Use search to filter
- "Unhide All" resets everything

---

## ⚠️ Notes

- Tag hiding is **UI-only** (does not modify database)
- Works best with up-to-date Stash versions
- Requires Stash plugin system enabled

---

## 🔧 Development

Plugin structure:

global-tag-hider/
├── global-tag-hider.yml
├── global-tag-hider.js
└── global-tag-hider.css

---

## 📜 License

MIT

---

## ❤️ Credits

Built for the Stash community  
Inspired by the need for cleaner, focused libraries

---

## 🚀 Future Ideas

- Tag groups / presets
- Import/export hidden lists
- Per-page filtering rules

---
