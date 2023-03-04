# Antidote Grammar Checker Integration

This Obsidian plugin is an unofficial integration of [Antidote](https://www.antidote.info/), a powerful grammar checker.

Antidote supports these languages:

- English
- French

This plugin works with Antidote 10 (using Connectix version 11 or higher) and higher, and Antidote web, on macOS (11 and higher), Linux and Windows.

**This plugin does not work on smartphones.**

![](./assets/obsidian.png)

![](./assets/antidote.png)

## How to install

### From Obsidian

This plugin can be found in Obsidian's community plugins library, `Settings > Community Plugins > Browse`: [antidote-grammar-checker-integration](https://obsidian.md/plugins?id=antidote-grammar-checker-integration)

### Manual installation

Download `main.js`, `manifest.json`, `styles.css` from the [latest release](https://github.com/heziode/obsidian-antidote/releases/latest) and put them into `<vault>/.obsidian/plugins/antidote-grammar-checker-integration` folder.

## How to use

This plugin adds 4 icons into the status bar:

- The check within a circle corresponding to the Antidote corrector, that will check the whole document
- The check corresponding to the Antidote corrector
- The green book corresponding to the Antidote dictionary
- The orange book corresponding to the Antidote guide

![](./assets/obsidian-statusbar.png)

You can show or hide every icon from settings.

It also adds command for corrector, dictionary and guide.

### Behavior of "Correct All" and "Corrector"

The "Correct All" send the whole document to Antidote, or, the selection, whereas the "simple correct" send the text depending the position of the cursor and the selection. The "simple correct" has the same behavior as the official integrations in other software (VS Code, Word, etc.).

### Additional note for Linux users

Antidote 10 is the latest supported version of Antidote on this OS. Accordingly, the Connectix version 10 installed with this version is not supported.

In order to use Antidote 10 (or web) with this plugin, you will have to install the latest version of Connectix (version 11 or higher). Connectix is the bridge between Obsidian and Antidote (10, 11+, web), so by keeping Antidote 10 with Connectix 11, you will be able to use this plugin.

You can download Connectix 11 from your [Client Portal](https://services.druide.com/client/), under the "Useful links" section: "Connectix Utility for Antidote Web"

## Support this plugin

<a href="https://paypal.me/foetools" target="_blank"><img src="https://img.shields.io/badge/paypal-foetools%20(heziode)-yellow?style=social&logo=paypal" alt="Donate with PayPal"></a>

<a href="https://www.buymeacoffee.com/Heziode" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" width="100" ></a>
