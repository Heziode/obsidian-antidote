import { EditorView } from '@codemirror/view';
import {
  App,
  MarkdownView,
  Notice,
  Plugin,
  PluginSettingTab,
  setIcon,
  Setting,
  WorkspaceLeaf,
} from 'obsidian';

import { AgentTexteurAPI } from './ObsidianTexteurAPI';
import { buyMeACoffee } from './assets/BuyMeACoffee';
import { paypal } from './assets/PayPal';
import { t } from './i18n';
import { AgentConnectix } from './lib/antidote/AgentConnectix';

const AcMap: WeakMap<MarkdownView, AgentConnectix> = new WeakMap();

function DonneAgentConnectixPourDocument(
  td: MarkdownView,
  checkWholeDocument = false
): AgentConnectix {
  if (td?.getMode() === 'source') {
    if (!AcMap.has(td)) {
      AcMap.set(
        td,
        new AgentConnectix(
          new AgentTexteurAPI(
            td,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ((td.editor as any).cm as EditorView).state.lineBreak,
            checkWholeDocument
          )
        )
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return AcMap.get(td)!;
  }
  throw Error('Unknown document');
}

// Remember to rename these classes and interfaces!

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

      this.handleCorrecteur(true);
    });

    // corrector
    this.correctorStatusBar = this.addStatusBarItem();
    this.setCorrectorStatusBarReady();
    this.correctorStatusBar.onClickEvent(() => {
      if (!this.app.workspace.activeEditor) {
        return;
      }

      this.handleCorrecteur();
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

      this.handleDictionnaire();
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

      this.handleDictionnaire();
    });

    app.workspace.onLayoutReady(() => {
      this.showOrHideIcons();
    });

    // Events //

    this.registerEvent(
      app.workspace.on('active-leaf-change', (leaf: WorkspaceLeaf | null) => {
        if (
          leaf?.view instanceof MarkdownView &&
          leaf.view.getMode() === 'source'
        ) {
          this.showStatusBarIcons();
        } else {
          this.hideStatusBarIcons();
        }
      })
    );

    this.registerEvent(
      app.workspace.on('layout-change', () => {
        const mdView = app.workspace.getActiveViewOfType(MarkdownView);

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

        this.handleCorrecteur(true);
      },
    });

    this.addCommand({
      id: 'antidote-corrector',
      name: t('command.corrector.label'),
      editorCallback: () => {
        if (!this.app.workspace.activeEditor) {
          return;
        }

        this.handleCorrecteur();
      },
    });

    this.addCommand({
      id: 'antidote-dictionary',
      name: t('command.dictionary.label'),
      editorCallback: () => {
        if (!this.app.workspace.activeEditor) {
          return;
        }

        this.handleDictionnaire();
      },
    });

    this.addCommand({
      id: 'antidote-guide',
      name: t('command.guide.label'),
      editorCallback: () => {
        if (!this.app.workspace.activeEditor) {
          return;
        }

        this.handleGuide();
      },
    });

    // This adds a settings tab so the user can configure various aspects of the plugin
    this.addSettingTab(new SettingTab(this.app, this));
  }

  public showOrHideIcons() {
    const mdView = app.workspace.getActiveViewOfType(MarkdownView);

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
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
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
          new Notice(t('error.antidote_not_found'));
          console.error(e);
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
          new Notice(t('error.antidote_not_found'));
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
          new Notice(t('error.antidote_not_found'));
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

  display(): void {
    const { containerEl } = this;

    containerEl.empty();
    containerEl.addClass('antidote-settings');

    const summary = containerEl.createEl('summary');
    new Setting(summary).setHeading().setName(t('settings.title'));
    summary.createDiv('collapser').createDiv('handle');

    new Setting(containerEl)
      .setName(t('settings.corrector_all.title'))
      .addToggle((t) => {
        t.setValue(this.plugin.settings.showCorrectorAllIcon).onChange(
          async (value) => {
            this.plugin.settings.showCorrectorAllIcon = value;
            await this.plugin.saveSettings();
            this.plugin.showOrHideIcons();
          }
        );
      });

    new Setting(containerEl)
      .setName(t('settings.corrector.title'))
      .addToggle((t) => {
        t.setValue(this.plugin.settings.showCorrectorIcon).onChange(
          async (value) => {
            this.plugin.settings.showCorrectorIcon = value;
            await this.plugin.saveSettings();
            this.plugin.showOrHideIcons();
          }
        );
      });

    new Setting(containerEl)
      .setName(t('settings.dictionary.title'))
      .addToggle((t) => {
        t.setValue(this.plugin.settings.showDictionaryIcon).onChange(
          async (value) => {
            this.plugin.settings.showDictionaryIcon = value;
            await this.plugin.saveSettings();
            this.plugin.showOrHideIcons();
          }
        );
      });

    new Setting(containerEl)
      .setName(t('settings.guide.title'))
      .addToggle((t) => {
        t.setValue(this.plugin.settings.showGuideIcon).onChange(
          async (value) => {
            this.plugin.settings.showGuideIcon = value;
            await this.plugin.saveSettings();
            this.plugin.showOrHideIcons();
          }
        );
      });

    const section = containerEl.createEl('section', {
      cls: 'donation-section',
    });

    const donateText = document.createElement('p');
    donateText.appendText(t('settings.donation'));
    section.appendChild(donateText);

    const parser = new DOMParser();

    const div = containerEl.createEl('div');
    div.addClass('antidote-settings-donation');

    div.appendChild(
      createDonateButton(
        'https://paypal.me/foetools',
        parser.parseFromString(paypal, 'text/xml').documentElement
      )
    );

    div.appendChild(
      createDonateButton(
        'https://www.buymeacoffee.com/Heziode',
        parser.parseFromString(buyMeACoffee, 'text/xml').documentElement
      )
    );

    section.appendChild(div);
  }
}

const createDonateButton = (link: string, img: HTMLElement): HTMLElement => {
  const a = document.createElement('a');
  a.setAttribute('href', link);
  a.addClass('donate-button');
  a.appendChild(img);
  return a;
};
