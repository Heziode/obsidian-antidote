import { parse as parseURL } from 'url';

import {
  EditorPosition,
  EditorSelection,
  MarkdownView,
  TFile,
  WorkspaceLeaf,
} from 'obsidian';

import {
  AgentTexteur,
  typeDocument,
  ZoneDeTexte,
} from './lib/antidote/InterfaceAgentTexteur';

export class AgentTexteurAPI extends AgentTexteur {
  private mdView: MarkdownView;
  private documentPath: string;
  private lineBreak: string;
  private checkWholeDocument: boolean;

  constructor(
    mdView: MarkdownView,
    lineBreak: string,
    checkWholeDocument: boolean
  ) {
    super();

    this.mdView = mdView;
    this.documentPath = mdView.file.path;
    this.lineBreak = lineBreak;
    this.checkWholeDocument = checkWholeDocument;
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  Initialise(): void {}

  private PositionAbsolue(pos: EditorPosition): number {
    return this.mdView.editor.posToOffset(pos);
  }

  private PositionObsidian(pos: number): EditorPosition {
    return this.mdView.editor.offsetToPos(pos);
  }

  DonneRetourDeCharriot(): string {
    return this.lineBreak;
  }

  DonneTitreDocument(): string {
    return this.mdView.file.name;
  }

  DonneCheminDocument(): string {
    return decodeURIComponent(
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      parseURL(this.mdView.app.vault.getResourcePath(this.mdView.file))
        .pathname!
    );
  }

  DonneTypeDocument(): typeDocument | undefined {
    if (['tex'].includes(this.mdView.file.extension)) {
      return 'latex';
    }

    if (
      ['markdown', 'mdown', 'mkdn', 'mkd', 'mdwn', 'md'].includes(
        this.mdView.file.extension
      )
    ) {
      return 'markdown';
    }

    if (['srt'].includes(this.mdView.file.extension)) {
      return 'subrip';
    }

    if (['txt', 'text', 'texte'].includes(this.mdView.file.extension)) {
      return 'texte';
    }

    // Unknown file type

    return undefined;
  }

  PermetsRetourDeCharriot(): boolean {
    return true;
  }

  DonneLesZonesACorriger(): Promise<ZoneDeTexte[]> {
    const text = this.mdView.editor.getValue();
    const selections: EditorSelection[] = this.mdView.editor.listSelections();

    if (
      this.checkWholeDocument &&
      selections.length === 1 &&
      this.PositionAbsolue(selections[0].anchor) ===
        this.PositionAbsolue(selections[0].head)
    ) {
      return new Promise<ZoneDeTexte[]>((resolve) =>
        resolve([new ZoneDeTexte(text, 0, 0, '0')])
      );
    }

    const lesZones: ZoneDeTexte[] = selections.map((selection, index) => {
      const start: EditorPosition = selection.head;
      const end = selection.anchor;
      const zone: ZoneDeTexte = new ZoneDeTexte(
        text,
        this.PositionAbsolue(start),
        this.PositionAbsolue(end),
        index.toString()
      );
      return zone;
    });

    return new Promise<ZoneDeTexte[]>((resolve) => resolve(lesZones));
  }

  PeutCorriger(
    _leIDZone: string,
    debut: number,
    fin: number,
    laChaineOrig: string
  ): boolean {
    if (!this.DocEstDisponible()) return false;

    const posDebut: EditorPosition = this.PositionObsidian(debut);
    let posFin: EditorPosition = this.PositionObsidian(fin);

    const contexteMatchParfaitement =
      this.mdView.editor.getRange(posDebut, posFin) == laChaineOrig;
    let contexteMatchAuDebut = true;

    if (!contexteMatchParfaitement) {
      posFin = this.PositionObsidian(fin + 1);
      contexteMatchAuDebut = this.mdView.editor
        .getRange(posDebut, posFin)
        .startsWith(laChaineOrig);
    }

    return contexteMatchParfaitement || contexteMatchAuDebut;
  }

  DocEstDisponible(): boolean {
    let isOpen = false;
    this.mdView.app.workspace.iterateAllLeaves((leaf) => {
      isOpen = isOpen || leaf.view === this.mdView;
    });
    return isOpen;
  }

  CorrigeDansTexteur(
    _leIDZone: string,
    leDebut: number,
    laFin: number,
    laChaine: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _automatique: boolean
  ): Promise<boolean> {
    const posDebut: EditorPosition = this.PositionObsidian(leDebut);
    const posFin: EditorPosition = this.PositionObsidian(laFin);
    return new Promise<boolean>((resolve) => {
      this.mdView.editor.replaceRange(laChaine, posDebut, posFin);
      resolve(true);
    });
  }

  RetourneAuTexteur(): void {
    this.MetsFocusSurLeDocument();
  }

  MetsFocusSurLeDocument(): void {
    let previousLeaf: WorkspaceLeaf | boolean = false;

    this.mdView.app.workspace.iterateAllLeaves((leaf) => {
      if (leaf.view === this.mdView) {
        previousLeaf = leaf;
      }
    });

    if (previousLeaf) {
      this.mdView.app.workspace.revealLeaf(previousLeaf);
      return;
    }

    const file = this.mdView.app.vault.getAbstractFileByPath(
      this.documentPath
    ) as TFile;

    this.mdView.app.workspace.getLeaf(true).openFile(file);
  }

  SelectionneIntervalle(_leIDZone: string, debut: number, fin: number): void {
    this.MetsFocusSurLeDocument();
    this.mdView.editor.setSelection(
      this.PositionObsidian(debut),
      this.PositionObsidian(fin)
    );
  }
}
