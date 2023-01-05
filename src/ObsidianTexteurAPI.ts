import * as path from 'path';

import { EditorView } from '@codemirror/view';
import {
  FileSystemAdapter,
  MarkdownView,
  TFile,
  WorkspaceLeaf,
} from 'obsidian';

import { AgentTexteur, ZoneDeTexte } from './lib/InterfaceAgentTexteur';

export class AgentTexteurAPI extends AgentTexteur {
  private edView: EditorView;
  private mdView: MarkdownView;
  private documentPath: string;
  private defaultFrom = 0;
  private defaultTo = Infinity;
  private defaultOffset = 0;

  constructor(edView: EditorView, mdView: MarkdownView, documentPath: string) {
    super();

    this.edView = edView;
    this.mdView = mdView;
    this.documentPath = documentPath;
  }

  Initialise(): void {
    this.defaultFrom = 0;
    this.defaultTo = this.mdView.data.length - 1;

    const selection = this.edView.state.selection.main;

    if (selection && selection.from !== selection.to) {
      this.defaultFrom = selection.from;
      this.defaultTo = selection.to;
    }
    this.defaultOffset = this.defaultFrom;
  }

  private ObtenirIntervalleDocument(
    from?: number,
    to?: number,
    takeIntoAccountInterval = true
  ): {
    text: string;
    offset: number;
    isRange: boolean;
    rangeFrom: number;
    rangeTo: number;
  } {
    // let selection;
    // if (takeIntoAccountInterval) {
    //   selection = this.edView.state.selection.main;
    // }

    let text = this.mdView.data;
    let offset = 0;
    let isRange = false;
    let rangeFrom = 0;
    let rangeTo = 0;

    // if (from === undefined && selection && selection.from !== selection.to) {
    //   from = selection.from;
    //   to = selection.to;
    // }

    if (from === undefined && to === undefined) {
      from = this.defaultFrom;
      to = this.defaultTo;
      offset = this.defaultOffset;
    }

    if (from !== undefined && to !== undefined) {
      text = this.edView.state.sliceDoc(from, to);
      offset = from;
      rangeFrom = from;
      rangeTo = to;
      isRange = true;
    }

    return { text, offset, rangeFrom, rangeTo, isRange };
  }

  DonneRetourDeCharriot(): string {
    return this.edView.state.lineBreak;
  }

  DonneTitreDocument(): string {
    return this.mdView.file.basename;
  }

  DonneCheminDocument(): string {
    const adapter = this.mdView.file.vault.adapter;
    let baseName = '';
    if (adapter instanceof FileSystemAdapter) {
      baseName = adapter.getBasePath();
    }
    return path.join(baseName, this.mdView.file.name);
  }

  PermetsRetourDeCharriot(): boolean {
    return true;
  }

  DonneLesZonesACorriger(): Promise<ZoneDeTexte[]> {
    return new Promise<ZoneDeTexte[]>((resolve) => {
      const lesZones: ZoneDeTexte[] = [];
      const data = this.ObtenirIntervalleDocument();

      const uneZone: ZoneDeTexte = new ZoneDeTexte(
        data.text,
        data.rangeFrom,
        data.rangeTo,
        '0'
      );

      lesZones.push(uneZone);
      resolve(lesZones);
    });
  }

  PeutCorriger(
    _leIDZone: string,
    debut: number,
    fin: number,
    laChaineOrig: string
  ): boolean {
    if (!this.DocEstDisponible()) return false;

    const data = this.ObtenirIntervalleDocument(undefined, undefined, false);

    const contexteMatchParfaitement =
      data.text.substring(debut, fin) == laChaineOrig;
    let contexteMatchAuDebut = true;
    if (!contexteMatchParfaitement) {
      contexteMatchAuDebut = data.text
        .substring(debut)
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
    _automatique: boolean
  ): Promise<boolean> {
    this.MetsFocusSurLeDocument();
    return new Promise<boolean>((resolve) => {
      this.mdView.editor.replaceRange(
        laChaine,
        this.mdView.editor.offsetToPos(leDebut + this.defaultOffset),
        this.mdView.editor.offsetToPos(laFin + this.defaultOffset)
      );
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
      this.mdView.editor.offsetToPos(debut + this.defaultOffset),
      this.mdView.editor.offsetToPos(fin + this.defaultOffset)
    );
  }
}
