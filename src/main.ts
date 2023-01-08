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

const AcMap: Map<WorkspaceLeaf, AgentConnectix> = new Map();

function DonneAgentConnectixPourDocument(td: WorkspaceLeaf): AgentConnectix {
  if (td?.view instanceof MarkdownView && td.view.getMode() === 'source') {
    if (!AcMap.has(td)) {
      AcMap.set(
        td,
        new AgentConnectix(
          'obsidian',
          new AgentTexteurAPI(
            (td.view.editor as any).cm,
            td.view,
            td.view.file.path
          )
        )
      );
    }

    return AcMap.get(td)!;
  }
  throw Error('Unknown document');
}

const simpleAgent = new AgentConnectix('obsidian');

// Remember to rename these classes and interfaces!

interface AntidotePluginSettings {
  showCorrectorIcon: boolean;
  showDictionaryIcon: boolean;
  showGuideIcon: boolean;
}

const DEFAULT_SETTINGS: AntidotePluginSettings = {
  showCorrectorIcon: true,
  showDictionaryIcon: true,
  showGuideIcon: true,
};

export default class AntidotePlugin extends Plugin {
  isloading = false;
  settings!: AntidotePluginSettings;
  private correctorStatusBar!: HTMLElement;
  private dictionaryStatusBar!: HTMLElement;
  private guidesStatusBar!: HTMLElement;

  async onload() {
    await this.loadSettings();

    // Status bar //

    // corrector
    this.correctorStatusBar = this.addStatusBarItem();
    this.setStatusBarReady();
    this.correctorStatusBar.onClickEvent((_) => {
      if (!this.app.workspace.activeEditor) {
        return;
      }

      this.handleStatusBarClick();
    });

    // dictionary

    this.dictionaryStatusBar = this.addStatusBarItem();
    this.dictionaryStatusBar.addClass('mod-clickable');
    this.dictionaryStatusBar.style.color = 'var(--color-green)';
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
    this.dictionaryStatusBar.onClickEvent((_) => {
      simpleAgent
        .Initialise()
        .then((_) => {
          simpleAgent.LanceDictionnaire();
        })
        .catch(() => {
          new Notice(t('error.antidote_not_found'));
        });
    });

    // guides
    this.guidesStatusBar = this.addStatusBarItem();
    this.guidesStatusBar.addClass('mod-clickable');
    this.guidesStatusBar.style.color = 'var(--color-orange)';
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
    this.guidesStatusBar.onClickEvent((_) => {
      simpleAgent
        .Initialise()
        .then((_) => {
          simpleAgent.LanceGuide();
        })
        .catch(() => {
          new Notice(t('error.antidote_not_found'));
        });
    });

    this.showOrHideIcons();

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
        const leaf = app.workspace.getLeaf();

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

    // Commands //

    this.addCommand({
      id: 'antidote-corrector',
      name: t('command.corrector.label'),
      editorCallback: () => {
        this.handleStatusBarClick();
      },
    });

    this.addCommand({
      id: 'antidote-dictionary',
      name: t('command.dictionary.label'),
      editorCallback: () => {
        simpleAgent
          .Initialise()
          .then((_) => {
            simpleAgent.LanceDictionnaire();
          })
          .catch(() => {
            new Notice(t('error.antidote_not_found'));
          });
      },
    });

    this.addCommand({
      id: 'antidote-guide',
      name: t('command.guide.label'),
      editorCallback: () => {
        simpleAgent
          .Initialise()
          .then((_) => {
            simpleAgent.LanceGuide();
          })
          .catch(() => {
            new Notice(t('error.antidote_not_found'));
          });
      },
    });

    // This adds a settings tab so the user can configure various aspects of the plugin
    this.addSettingTab(new SettingTab(this.app, this));
  }

  public showOrHideIcons() {
    const leaf = app.workspace.getLeaf();

    if (
      leaf?.view instanceof MarkdownView &&
      leaf.view.getMode() === 'source'
    ) {
      this.showStatusBarIcons();
    } else {
      this.hideStatusBarIcons();
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
    if (!this.settings.showCorrectorIcon) {
      this.hideStatusBarIcons();
      return;
    }
    this.correctorStatusBar.removeClass('hide');
    if (this.settings.showDictionaryIcon) {
      this.dictionaryStatusBar.removeClass('hide');
    }

    if (this.settings.showGuideIcon) {
      this.guidesStatusBar.removeClass('hide');
    }
  }

  public hideStatusBarIcons() {
    this.correctorStatusBar.addClass('hide');
    this.dictionaryStatusBar.addClass('hide');
    this.guidesStatusBar.addClass('hide');
  }

  public setStatusBarReady() {
    this.isloading = false;
    this.correctorStatusBar.empty();
    this.correctorStatusBar.addClass('mod-clickable');
    this.correctorStatusBar.style.color = 'var(--color-green)';
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

  public setStatusBarWorking() {
    if (this.isloading) return;

    this.isloading = true;
    this.correctorStatusBar.empty();
    this.correctorStatusBar.addClass('mod-clickable');
    this.correctorStatusBar.style.color = '';
    this.correctorStatusBar.createSpan(
      { cls: ['lt-status-bar-btn', 'spin-loading'] },
      (span) => {
        setIcon(span, 'refresh-cw');
      }
    );
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  private readonly handleStatusBarClick = async () => {
    const activeLeaf = this.app.workspace.getLeaf();

    if (
      activeLeaf?.view instanceof MarkdownView &&
      activeLeaf.view.getMode() === 'source'
    ) {
      try {
        const AC = DonneAgentConnectixPourDocument(activeLeaf);
        try {
          await AC.Initialise();
        } catch (e) {
          new Notice(t('error.antidote_not_found'));
          return;
        }
        AC.LanceCorrecteur();
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
    div.style.display = 'flex';
    div.style.marginTop = '2em';

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
