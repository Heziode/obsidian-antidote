import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { builtinModules } from 'node:module';
import path from 'node:path';
import process from 'node:process';

import esbuild from 'esbuild';

const production = !process.argv.includes('--dev');
const outdir = 'dist';

/**
 * Obsidian, the editor it embeds and Electron's own modules are all provided by
 * the application at runtime. Bundling them would ship a second copy that never
 * gets used, and in the case of the editor, one that does not share state with
 * the running instance.
 */
const external = [
  'obsidian',
  'electron',
  '@codemirror/autocomplete',
  '@codemirror/collab',
  '@codemirror/commands',
  '@codemirror/language',
  '@codemirror/lint',
  '@codemirror/search',
  '@codemirror/state',
  '@codemirror/view',
  '@lezer/common',
  '@lezer/highlight',
  '@lezer/lr',
  ...builtinModules,
  ...builtinModules.map((name) => `node:${name}`),
];

/**
 * Where a development build is copied so that Obsidian picks it up. Answers
 * null when no vault was named, in which case the build stays in `dist`.
 */
async function DonneDossierInstallation() {
  const drapeau = process.argv.indexOf('--vault');
  const vault =
    drapeau === -1 ? process.env.OBSIDIAN_VAULT : process.argv[drapeau + 1];

  if (!vault) return null;

  const manifest = JSON.parse(await readFile('manifest.json', 'utf8'));
  return path.join(vault, '.obsidian', 'plugins', manifest.id);
}

/** Put the three files Obsidian loads where they are expected. */
async function Publie(dossier) {
  await mkdir(dossier, { recursive: true });
  await copyFile('manifest.json', path.join(dossier, 'manifest.json'));

  if (dossier === outdir) return;

  for (const fichier of ['main.js', 'styles.css']) {
    await copyFile(path.join(outdir, fichier), path.join(dossier, fichier));
  }
}

const dossierInstallation = await DonneDossierInstallation();

const options = {
  entryPoints: ['src/main.ts', 'src/styles.css'],
  outdir,
  bundle: true,
  external,
  format: 'cjs',
  platform: 'node',
  mainFields: ['browser', 'module', 'main'],
  target: 'es2018',
  treeShaking: true,
  minify: production,
  sourcemap: production ? false : 'inline',
  logLevel: 'info',
};

if (production) {
  await esbuild.build(options);
  await Publie(outdir);
} else {
  const contexte = await esbuild.context({
    ...options,
    plugins: [
      {
        name: 'publie',
        setup(build) {
          build.onEnd(async (resultat) => {
            if (resultat.errors.length > 0) return;
            await Publie(outdir);
            if (dossierInstallation) await Publie(dossierInstallation);
          });
        },
      },
    ],
  });
  await contexte.watch();
}
