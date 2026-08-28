import {
  App,
  Editor,
  MarkdownView,
  Notice,
  Plugin,
  PluginSettingTab,
  setIcon,
  Setting,
  SettingDefinitionItem,
  WorkspaceLeaf,
} from 'obsidian';

import { AgentTexteurAPI } from './ObsidianTexteurAPI';
import { buyMeACoffee } from './assets/BuyMeACoffee';
import { paypal } from './assets/PayPal';
import { t } from './i18n';
import {
  AgentConnectix,
  AgentIntrouvable,
} from './lib/antidote/AgentConnectix';
import { TransItemType } from './translations';

const AcMap: WeakMap<MarkdownView, AgentConnectix> = new WeakMap();

/**
 * Obsidian hands out the CodeMirror view backing an editor outside of its
 * public API. Only the line separator of the document is read from it.
 */
interface EditeurAvecCodeMirror {
  cm?: { state?: { lineBreak?: string } };
}

/** Line separator the document is written with, `\n` unless CodeMirror says otherwise. */
function DonneRetourDeCharriot(editor: Editor): string {
  const cm = (editor as Editor & EditeurAvecCodeMirror).cm;
  return cm?.state?.lineBreak ?? '\n';
}

/**
 * Tell the user why a command could not reach Antidote. Not having Antidote
 * installed at all is by far the most common cause, and deserves an answer of
 * its own rather than a communication error.
 */
function showInitialisationError(e: unknown) {
  new Notice(
    e instanceof AgentIntrouvable
      ? t('error.antidote_not_installed')
      : t('error.antidote_not_found')
  );
  console.error(e);
}

function DonneAgentConnectixPourDocument(
  td: MarkdownView,
  checkWholeDocument = false
): AgentConnectix {
  if (td.getMode() !== 'source') {
    throw Error('Unknown document');
  }

  let agent = AcMap.get(td);

  if (agent === undefined) {
    agent = new AgentConnectix(
      new AgentTexteurAPI(
        td,
        DonneRetourDeCharriot(td.editor),
        checkWholeDocument
      )
    );
    AcMap.set(td, agent);
  }

  return agent;
}

interface AntidotePluginSettings {
  showCorrectorAllIcon: boolean;
  showCorrectorIcon: boolean;
  showDictionaryIcon: boolean;
  showGuideIcon: boolean;
}

const DEFAULT_SETTINGS: AntidotePluginSettings = {
  showCorrectorAllIcon: true,
  showCorrectorIcon: true,
  showDictionaryIcon: true,
  showGuideIcon: true,
};

/** A status bar icon the user can turn on and off, and the setting behind it. */
interface IconeReglable {
  cle: keyof AntidotePluginSettings;
  titre: TransItemType;
}

/** The status bar icons the user can turn on and off, in display order. */
const ICONES_REGLABLES: readonly IconeReglable[] = [
  { cle: 'showCorrectorAllIcon', titre: 'settings.corrector_all.title' },
  { cle: 'showCorrectorIcon', titre: 'settings.corrector.title' },
  { cle: 'showDictionaryIcon', titre: 'settings.dictionary.title' },
  { cle: 'showGuideIcon', titre: 'settings.guide.title' },
];

/** Where a donation button points, and the artwork drawn on it. */
const LES_DONS = [
  { lien: 'https://paypal.me/foetools', image: paypal },
  { lien: 'https://www.buymeacoffee.com/Heziode', image: buyMeACoffee },
] as const;

/**
 * Turn a setting row into the donation row. Shared by the declarative settings
 * of Obsidian 1.13 and the imperative fallback used by older versions.
 */
function AfficheLesDons(setting: Setting): void {
  setting
    .setName(t('settings.donation.title'))
    .setDesc(t('settings.donation.text'));

  const parser = new DOMParser();

  for (const don of LES_DONS) {
    const bouton = setting.controlEl.createEl('a', {
      cls: 'donate-button',
      href: don.lien,
    });
    bouton.appendChild(
      parser.parseFromString(don.image, 'text/xml').documentElement
    );
  }
}

export default class AntidotePlugin extends Plugin {
  isloading = false;
  settings!: AntidotePluginSettings;
  private correctorAllStatusBar!: HTMLElement;
  private correctorStatusBar!: HTMLElement;
  private dictionaryStatusBar!: HTMLElement;
  private guidesStatusBar!: HTMLElement;

  async onload() {
    await this.loadSettings();

    // Status bar //

    // corrector all document
    this.correctorAllStatusBar = this.addStatusBarItem();
    this.setCorrectorAllStatusBarReady();
    this.correctorAllStatusBar.onClickEvent(() => {
      if (!this.app.workspace.activeEditor) {
        return;
      }

      void this.handleCorrecteur(true);
    });

    // corrector
    this.correctorStatusBar = this.addStatusBarItem();
    this.setCorrectorStatusBarReady();
    this.correctorStatusBar.onClickEvent(() => {
      if (!this.app.workspace.activeEditor) {
        return;
      }

      void this.handleCorrecteur();
    });

    // dictionary

    this.dictionaryStatusBar = this.addStatusBarItem();
    this.dictionaryStatusBar.addClass('mod-clickable', 'antidote-green');
    this.dictionaryStatusBar.createSpan(
      {
        attr: {
          'aria-label-position': 'top',
          'aria-label': t('sidebar.dictionary.label'),
        },
      },
      (span) => {
        setIcon(span, 'book');
      }
    );
    this.dictionaryStatusBar.onClickEvent(() => {
      if (!this.app.workspace.activeEditor) {
        return;
      }

      void this.handleDictionnaire();
    });

    // guides
    this.guidesStatusBar = this.addStatusBarItem();
    this.guidesStatusBar.addClass('mod-clickable', 'antidote-orange');
    this.guidesStatusBar.createSpan(
      {
        attr: {
          'aria-label-position': 'top',
          'aria-label': t('sidebar.guide.label'),
        },
      },
      (span) => {
        setIcon(span, 'book');
      }
    );
    this.guidesStatusBar.onClickEvent(() => {
      if (!this.app.workspace.activeEditor) {
        return;
      }

      void this.handleGuide();
    });

    this.app.workspace.onLayoutReady(() => {
      this.showOrHideIcons();
    });

    // Events //

    this.registerEvent(
      this.app.workspace.on(
        'active-leaf-change',
        (leaf: WorkspaceLeaf | null) => {
          if (
            leaf?.view instanceof MarkdownView &&
            leaf.view.getMode() === 'source'
          ) {
            this.showStatusBarIcons();
          } else {
            this.hideStatusBarIcons();
          }
        }
      )
    );

    this.registerEvent(
      this.app.workspace.on('layout-change', () => {
        const mdView = this.app.workspace.getActiveViewOfType(MarkdownView);

        if (mdView?.getMode() === 'source') {
          this.showStatusBarIcons();
        } else {
          this.hideStatusBarIcons();
        }
      })
    );

    // Commands //

    this.addCommand({
      id: 'antidote-corrector-all',
      name: t('command.corrector_all.label'),
      editorCallback: () => {
        if (!this.app.workspace.activeEditor) {
          return;
        }

        void this.handleCorrecteur(true);
      },
    });

    this.addCommand({
      id: 'antidote-corrector',
      name: t('command.corrector.label'),
      editorCallback: () => {
        if (!this.app.workspace.activeEditor) {
          return;
        }

        void this.handleCorrecteur();
      },
    });

    this.addCommand({
      id: 'antidote-dictionary',
      name: t('command.dictionary.label'),
      editorCallback: () => {
        if (!this.app.workspace.activeEditor) {
          return;
        }

        void this.handleDictionnaire();
      },
    });

    this.addCommand({
      id: 'antidote-guide',
      name: t('command.guide.label'),
      editorCallback: () => {
        if (!this.app.workspace.activeEditor) {
          return;
        }

        void this.handleGuide();
      },
    });

    // This adds a settings tab so the user can configure various aspects of the plugin
    this.addSettingTab(new SettingTab(this.app, this));
  }

  public showOrHideIcons() {
    const mdView = this.app.workspace.getActiveViewOfType(MarkdownView);

    const isDocumentFocus = mdView?.getMode() === 'source';

    if (isDocumentFocus && this.settings.showCorrectorIcon) {
      this.correctorStatusBar.removeClass('hide');
    } else {
      this.correctorStatusBar.addClass('hide');
    }

    if (isDocumentFocus && this.settings.showCorrectorAllIcon) {
      this.correctorAllStatusBar.removeClass('hide');
    } else {
      this.correctorAllStatusBar.addClass('hide');
    }

    if (this.settings.showDictionaryIcon) {
      this.dictionaryStatusBar.removeClass('hide');
    } else {
      this.dictionaryStatusBar.addClass('hide');
    }

    if (this.settings.showGuideIcon) {
      this.guidesStatusBar.removeClass('hide');
    } else {
      this.guidesStatusBar.addClass('hide');
    }
  }

  public showStatusBarIcons() {
    if (this.settings.showCorrectorAllIcon) {
      this.correctorAllStatusBar.removeClass('hide');
    }
    if (this.settings.showCorrectorIcon) {
      this.correctorStatusBar.removeClass('hide');
    }
    if (this.settings.showDictionaryIcon) {
      this.dictionaryStatusBar.removeClass('hide');
    }

    if (this.settings.showGuideIcon) {
      this.guidesStatusBar.removeClass('hide');
    }
  }

  public hideStatusBarIcons() {
    this.correctorAllStatusBar.addClass('hide');
    this.correctorStatusBar.addClass('hide');
    this.dictionaryStatusBar.addClass('hide');
    this.guidesStatusBar.addClass('hide');
  }

  public setCorrectorStatusBarReady() {
    this.isloading = false;
    this.correctorStatusBar.empty();
    this.correctorStatusBar.addClass('mod-clickable', 'antidote-green');
    this.correctorStatusBar.createSpan(
      {
        attr: {
          'aria-label-position': 'top',
          'aria-label': t('sidebar.corrector.label'),
        },
      },
      (span) => {
        setIcon(span, 'check');
      }
    );
  }

  public setCorrectorAllStatusBarReady() {
    this.isloading = false;
    this.correctorAllStatusBar.empty();
    this.correctorAllStatusBar.addClass('mod-clickable', 'antidote-green');
    this.correctorAllStatusBar.createSpan(
      {
        attr: {
          'aria-label-position': 'top',
          'aria-label': t('sidebar.corrector_all.label'),
        },
      },
      (span) => {
        setIcon(span, 'check-circle');
      }
    );
  }

  async loadSettings() {
    // What was persisted may predate the settings of this version: read it as a
    // partial and let the defaults fill in whatever is missing.
    const enregistre = (await this.loadData()) as
      | Partial<AntidotePluginSettings>
      | null
      | undefined;

    this.settings = { ...DEFAULT_SETTINGS, ...enregistre };
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  private readonly handleCorrecteur = async (checkWholeDocument = false) => {
    const mdView = this.app.workspace.getActiveViewOfType(MarkdownView);

    if (mdView?.getMode() === 'source') {
      try {
        const AC = DonneAgentConnectixPourDocument(mdView, checkWholeDocument);
        try {
          await AC.Initialise();
        } catch (e) {
          showInitialisationError(e);
          return;
        }
        AC.LanceCorrecteur();
      } catch (e) {
        console.error(e);
      }
    }
  };

  private readonly handleDictionnaire = async () => {
    const mdView = this.app.workspace.getActiveViewOfType(MarkdownView);

    if (mdView?.getMode() === 'source') {
      try {
        const AC = DonneAgentConnectixPourDocument(mdView);
        try {
          await AC.Initialise();
        } catch (e) {
          showInitialisationError(e);
          return;
        }
        AC.LanceDictionnaire();
      } catch (e) {
        console.error(e);
      }
    }
  };

  private readonly handleGuide = async () => {
    const mdView = this.app.workspace.getActiveViewOfType(MarkdownView);

    if (mdView?.getMode() === 'source') {
      try {
        const AC = DonneAgentConnectixPourDocument(mdView);
        try {
          await AC.Initialise();
        } catch (e) {
          showInitialisationError(e);
          return;
        }
        AC.LanceGuide();
      } catch (e) {
        console.error(e);
      }
    }
  };
}

class SettingTab extends PluginSettingTab {
  plugin: AntidotePlugin;

  constructor(app: App, plugin: AntidotePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  /**
   * Declarative settings, so that Obsidian renders them and, above all, finds
   * them through the settings search. Replaces `display()`, which Obsidian
   * ignores as soon as this answers a non-empty array.
   */
  getSettingDefinitions(): SettingDefinitionItem[] {
    return [
      ...ICONES_REGLABLES.map((icone) => ({
        name: t(icone.titre),
        control: {
          type: 'toggle' as const,
          key: icone.cle,
          defaultValue: DEFAULT_SETTINGS[icone.cle],
        },
      })),
      {
        name: t('settings.donation.title'),
        desc: t('settings.donation.text'),
        render: (setting: Setting) => {
          AfficheLesDons(setting);
        },
      },
    ];
  }

  /** Keep the status bar in step with a setting the user just changed. */
  async setControlValue(key: string, value: unknown): Promise<void> {
    await super.setControlValue(key, value);
    this.plugin.showOrHideIcons();
  }
}
