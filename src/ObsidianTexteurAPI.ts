import { createHash } from 'crypto';
import * as path from 'path';
import { parse as parseURL } from 'url';

import { EditorView } from '@codemirror/view';
import {
  EditorPosition,
  EditorRange,
  EditorSelection,
  FileSystemAdapter,
  MarkdownView,
  TFile,
  WorkspaceLeaf,
} from 'obsidian';

import { AgentTexteur, ZoneDeTexte } from './lib/InterfaceAgentTexteur';
import { Range, Selection } from './lib/rangeUtils';
import { getWordRangeAtPosition } from './lib/textUtils';

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

  private PositionAbsolue(pos: EditorPosition): number {
    return this.mdView.editor.posToOffset(pos);
  }

  private PositionVS(pos: number): EditorPosition {
    return this.mdView.editor.offsetToPos(pos);
  }

  DonneRetourDeCharriot(): string {
    return this.edView.state.lineBreak;
  }

  async DonneSelectionDansSonContexte(): Promise<{
    texte: string;
    debutSelection: number;
    finSelection: number;
  }> {
    let selectedText = '';
    let startOffset = 0;
    let endOffset = 0;

    let range: Range | undefined;
    const selection: Selection = Selection.ofSel(
      this.mdView.editor.listSelections()[0]
    );
    const sentenceRegex = new RegExp('[^.!?]*[.!?]');
    const startSentenceRange = getWordRangeAtPosition(
      this.mdView,
      selection.start,
      sentenceRegex
    );
    const endSentenceRange = getWordRangeAtPosition(
      this.mdView,
      selection.end,
      sentenceRegex
    );

    if (endSentenceRange) {
      range = startSentenceRange
        ? startSentenceRange.union(endSentenceRange)
        : undefined;
    }

    selectedText = range
      ? this.mdView.editor.getRange(
          range.start.toEditorPosition(),
          range.end.toEditorPosition()
        )
      : this.mdView.editor.getValue();
    startOffset =
      this.PositionAbsolue(selection.start.toEditorPosition()) -
      this.PositionAbsolue(
        range
          ? range.start.toEditorPosition()
          : selection.start.toEditorPosition()
      );
    endOffset =
      this.PositionAbsolue(selection.end.toEditorPosition()) -
      this.PositionAbsolue(
        range ? range.end.toEditorPosition() : selection.end.toEditorPosition()
      );

    return new Promise((resolve) =>
      resolve({
        texte: selectedText,
        debutSelection: startOffset,
        finSelection: endOffset,
      })
    );
  }

  DonneTitreDocument(): string {
    return this.mdView.file.basename + '.md';
  }

  DonneCheminDocument(): string {
    return decodeURIComponent(
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      parseURL(this.mdView.app.vault.getResourcePath(this.mdView.file))
        .pathname!
    );
    // const adapter = this.mdView.file.vault.adapter;
    // let baseName = '';
    // if (adapter instanceof FileSystemAdapter) {
    //   baseName = adapter.getBasePath();
    // }
    // return path.join(baseName, this.mdView.file.name);
  }

  PermetsRetourDeCharriot(): boolean {
    return true;
  }

  DonneLesZonesACorriger(): Promise<ZoneDeTexte[]> {
    const text = this.mdView.editor.getValue();
    const selections: EditorSelection[] = this.mdView.editor.listSelections();
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

  DonneIdWSExpediteur() {
    const hash = createHash('md5');
    const id = new Date().getTime().toString();

    hash.update(this.DonneTitreDocument());
    hash.update(id);
    return 'vsc' + hash.digest('hex');
  }

  DonneNomExpediteur() {
    return 'ConnecteurVsCode';
  }

  PeutCorriger(
    _leIDZone: string,
    debut: number,
    fin: number,
    laChaineOrig: string
  ): boolean {
    if (!this.DocEstDisponible()) return false;

    const posDebut: EditorPosition = this.PositionVS(debut);
    let posFin: EditorPosition = this.PositionVS(fin);

    const contexteMatchParfaitement =
      this.mdView.editor.getRange(posDebut, posFin) == laChaineOrig;
    let contexteMatchAuDebut = true;

    if (!contexteMatchParfaitement) {
      posFin = this.PositionVS(fin + 1);
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
    _automatique: boolean
  ): Promise<boolean> {
    const posDebut: EditorPosition = this.PositionVS(leDebut);
    const posFin: EditorPosition = this.PositionVS(laFin);
    return new Promise<boolean>((resolve) => {
      this.mdView.editor.replaceRange(laChaine, posDebut, posFin);
      resolve(true);
    });
    // this.MetsFocusSurLeDocument();
    // return new Promise<boolean>((resolve) => {
    //   this.mdView.editor.replaceRange(
    //     laChaine,
    //     this.mdView.editor.offsetToPos(leDebut + this.defaultOffset),
    //     this.mdView.editor.offsetToPos(laFin + this.defaultOffset)
    //   );
    //   resolve(true);
    // });
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
      this.PositionVS(debut + this.defaultOffset),
      this.PositionVS(fin + this.defaultOffset)
    );
  }

  DocEstMort(): boolean {
    return !this.DocEstDisponible();
  }
  DonneDebutSelection(): Promise<number> {
    const selection: Selection = Selection.ofSel(
      this.mdView.editor.listSelections()[0]
    );
    return new Promise((resolve) => {
      resolve(this.PositionAbsolue(selection.start.toEditorPosition()));
    });
  }
  RemplaceMot(valeur: string): Promise<void> {
    this.mdView.editor.replaceSelection(valeur);

    return new Promise((resolve) => {
      resolve();
    });
  }
}
