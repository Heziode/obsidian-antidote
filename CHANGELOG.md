# 2.3.0 (Fri Aug 28 2026)

**This release requires Obsidian 1.13.0 or higher.** `minAppVersion` had claimed 0.15.0 since 2022 while the plugin moved on without it: 2.2.0 already fails on anything older than 1.7.2. Obsidian only ever offers you the newest release your app supports, so an older Obsidian keeps the version it has.

#### 🚀 Enhancement

- feat: move the settings tab to the declarative settings API ([@Heziode](https://github.com/Heziode))

#### 🐛 Bug Fix

- fix: declare the Obsidian version the plugin actually requires ([@Heziode](https://github.com/Heziode))
- fix: reassemble Connectix messages split over several packets ([@Heziode](https://github.com/Heziode))
- fix: read WebSocket frames that arrive as an array buffer ([@Heziode](https://github.com/Heziode))
- fix: stop assuming a vault keeps its configuration in .obsidian ([@Heziode](https://github.com/Heziode))
- fix: declare @types/node and keep the lockfile in sync ([@Heziode](https://github.com/Heziode))

#### 🏠 Internal

- refactor: describe the Connectix protocol with types instead of any ([@Heziode](https://github.com/Heziode))
- refactor: reach the vault through supported, non-deprecated APIs ([@Heziode](https://github.com/Heziode))
- style: colour the status bar by specificity instead of !important ([@Heziode](https://github.com/Heziode))
- build: lint with the rules the Obsidian team runs against plugins ([@Heziode](https://github.com/Heziode))
- build: bundle with esbuild directly and drop the unused template tooling ([@Heziode](https://github.com/Heziode))
- ci: build, attest and publish releases from a workflow ([@Heziode](https://github.com/Heziode))

#### 📝 Documentation

- docs: describe the new development workflow ([@Heziode](https://github.com/Heziode))
- docs: fix two typos in the contributing guide ([@Heziode](https://github.com/Heziode))

#### Authors: 1

- Quentin Dauprat ([@Heziode](https://github.com/Heziode))

---

# 2.2.0 (Tue Aug 18 2026)

#### 🚀 Enhancement

- feat: tell the user when Antidote itself is not installed ([@Heziode](https://github.com/Heziode))

#### 🐛 Bug Fix

- fix: read Connectix preferences without hitting the bplist object limit [#18](https://github.com/Heziode/obsidian-antidote/issues/18) ([@Heziode](https://github.com/Heziode))
- fix: always settle the Connectix agent initialisation ([@Heziode](https://github.com/Heziode))

#### 📝 Documentation

- docs: document the requirements, Connectix 11 and troubleshooting [#15](https://github.com/Heziode/obsidian-antidote/issues/15) ([@Heziode](https://github.com/Heziode))

#### Authors: 1

- Quentin Dauprat ([@Heziode](https://github.com/Heziode))

---

# 2.1.2 (Sun May 28 2023)

#### 🐛 Bug Fix

- fix: fix issue related to connection with Connectix Agent ([@Heziode](https://github.com/Heziode))

#### Authors: 1

- Quentin Dauprat ([@Heziode](https://github.com/Heziode))

---

# 2.1.1 (Thu Feb 02 2023)

#### 🐛 Bug Fix

- fix: fix plugin crash at Obsidian startup ([@Heziode](https://github.com/Heziode))
- refactor: clean `AgentTexteurAPI` constructor ([@Heziode](https://github.com/Heziode))
- refactor: use of `getActiveViewOfType` instead of `getLeaf` ([@Heziode](https://github.com/Heziode))
- feat: force the markdown filter for Obsidian documents [#10](https://github.com/Heziode/obsidian-antidote/pull/10) ([@Heziode](https://github.com/Heziode))
- Correct typo in init response. [#11](https://github.com/Heziode/obsidian-antidote/pull/11) ([@Acibi](https://github.com/Acibi))
- refactor: use of WeakMap to prevent memory leak ([@Heziode](https://github.com/Heziode))
- style: use of CSS class instead of hard-coded style ([@Heziode](https://github.com/Heziode))
- style: change the "correct all" icon ([@Heziode](https://github.com/Heziode))

#### Authors: 2

- Quentin Dauprat ([@Heziode](https://github.com/Heziode))
- Simon Langevin ([@Acibi](https://github.com/Acibi))

---

# 2.1.0 (Sun Jan 22 2023)

#### 🚀 Enhancement

- feat: add a button to check the whole document ([@Heziode](https://github.com/Heziode))

#### 🐛 Bug Fix

- fix: fix state of corrector icon depending on focus and settings ([@Heziode](https://github.com/Heziode))

#### Authors: 1

- Quentin Dauprat ([@Heziode](https://github.com/Heziode))

---

# 2.0.0 (Thu Jan 12 2023)

#### 💥 Breaking Change

- feat!: using Antidote public API instead of old private API [#5](https://github.com/Heziode/obsidian-antidote/pull/5) ([@Heziode](https://github.com/Heziode))

#### Authors: 2

- Quentin Dauprat ([@Heziode](https://github.com/Heziode))
- Simon Langevin ([@Acibi - DruideInformatiqueInc](https://github.com/Acibi))

---

# 1.1.0 (Mon Jan 09 2023)

#### 🚀 Enhancement

- feat: add command to launch corrector, dictionary and guide ([@Heziode](https://github.com/Heziode))
- feat: allow to disable Spellcheck button into the status bar ([@Heziode](https://github.com/Heziode))

#### 🐛 Bug Fix

- doc: update README.md ([@Heziode](https://github.com/Heziode))
- Refactor of Antidote WebSocket API client to supports the same features as VS Code extension [#4](https://github.com/Heziode/obsidian-antidote/pull/4) ([@Heziode](https://github.com/Heziode))

#### Authors: 1

- Quentin Dauprat ([@Heziode](https://github.com/Heziode))

---

# 1.0.1 (Fri Jan 06 2023)

#### 🐛 Bug Fix

- style: fix typo ([@Heziode](https://github.com/Heziode))
- fix: repair of the Dictionary and Guide buttons that were no longer working ([@Heziode](https://github.com/Heziode))
- fix: fix the state (show/hide) of dictionary and guide icon depending on the focus ([@Heziode](https://github.com/Heziode))
- doc: update README ([@Heziode](https://github.com/Heziode))

#### Authors: 1

- Quentin Dauprat ([@Heziode](https://github.com/Heziode))

---

# 1.0.0 (Thu Jan 05 2023)

#### 💥 Breaking Change

- feat!: initial commit ([@Heziode](https://github.com/Heziode))

#### Authors: 1

- Quentin Dauprat ([@Heziode](https://github.com/Heziode))
