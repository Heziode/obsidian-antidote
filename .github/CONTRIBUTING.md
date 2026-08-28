# Contributing to Antidote plugin

Thank you for your interest. Contributions are welcome. This guide will help you setting up the development environment.

Clone this repository, and run `npm i` to install dependencies.

It is highly recommended to run your tests in a "Sandbox" Obsidian vault, either the default Obsidian sandbox or your own vault.

Inside this vault, install [Hot-Reload](https://github.com/pjeby/hot-reload) plugin in order to enhance your development experience.

You can now run `npm run dev` to start developing. It builds into `dist/` and rebuilds on every change. To have it installed into your sandbox vault at the same time, run `npm run dev -- --vault /path/to/your/vault`, or set the `OBSIDIAN_VAULT` environment variable to that path.
