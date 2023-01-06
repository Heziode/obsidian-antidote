import { randomBytes } from 'crypto';
export abstract class AgentTexteur {
  private guid: string;

  constructor() {
    this.guid = randomBytes(16).toString('base64').slice(0, 16);
  }

  abstract Initialise(): void;

  DonneIDCommunication() {
    return this.guid;
  }

  DonneSiSynchroniseSurAppelDesOutils() {
    return false;
  }

  EstTexteurDAntidote() {
    return false;
  }
  JePeuxCorrigerSansSelection() {
    return false;
  }

  RompsLienCorrecteur() {}
  RompsLienTexteur() {}
  SelectionneApresRemplace(data: any) {}
  SynchroFinie() {}
  TexteModifieDepuisSynchro() {
    return true;
  }

  //Information sur le texteur
  abstract DonneRetourDeCharriot(): string;
  abstract DonneTitreDocument(): string;
  abstract DonneSelectionDansSonContexte(): Promise<{
    texte: string;
    debutSelection: number;
    finSelection: number;
  }>;
  abstract DonneCheminDocument(): string;
  EspaceFineDisponible(): boolean {
    return false;
  }
  JeTraiteLesInsecables(): boolean {
    return true;
  }
  abstract DocEstMort(): boolean;
  abstract PermetsRetourDeCharriot(): boolean;
  abstract DonneDebutSelection(): Promise<number>;
  abstract RemplaceMot(valeur: string): Promise<void>;

  DonneProgression() {
    return 0;
  }
  InitPourCorrecteur() {}
  InitPourOutils(a: boolean) {}
  ReinitialisePourCorrecteur() {}
  ReinitialisePourOutils() {}

  // Requête d'Antidote
  abstract DonneLesZonesACorriger(): Promise<ZoneDeTexte[]>;
  abstract PeutCorriger(
    leIDZone: string,
    debut: number,
    fin: number,
    laChaineOrig: string
  ): boolean;
  abstract DocEstDisponible(): boolean;

  // Actions requises depuis Antidote
  abstract CorrigeDansTexteur(
    leIDZone: string,
    leDebut: number,
    laFin: number,
    laChaine: string,
    automatique: boolean
  ): Promise<boolean>;
  abstract RetourneAuTexteur(): void;
  abstract MetsFocusSurLeDocument(): void;
  abstract SelectionneIntervalle(
    leIDZone: string,
    debut: number,
    fin: number
  ): void;

  abstract DonneIdWSExpediteur(): string;
  abstract DonneNomExpediteur(): string;

  DonneNomTexteur() {
    return 'obsidian';
  }
}

export interface ZoneDeTexteJSONAPI {
  texte: string; //Texte
  positionSelectionDebut: number; //Début Sélection
  positionSelectionFin: number; //Fin Sélection
  zoneEstEnFocus: boolean;
  idZone: string; //IdZone
}

export class ZoneDeTexte {
  private texte: string;
  private id: string;
  private selDebut: number;
  private selFin: number;

  constructor(
    leTexte: string,
    selectionDebut?: number,
    selectionFin?: number,
    guid?: string
  ) {
    this.texte = leTexte;
    if (selectionDebut) this.selDebut = selectionDebut;
    else this.selDebut = 0;

    if (selectionFin) this.selFin = selectionFin;
    else this.selFin = 0;

    if (guid) this.id = guid;
    else this.id = '';
  }

  toJson(): { _dib30: string; _dib31: number; _dib32: number; _dib99: string } {
    return {
      _dib30: Buffer.from(this.texte).toString('base64'),
      _dib31: this.selDebut,
      _dib32: this.selFin,
      _dib99: Buffer.from(this.id).toString('base64'),
    };
  }

  toJsonAPI(): ZoneDeTexteJSONAPI {
    return {
      texte: this.texte,
      positionSelectionDebut: this.selDebut,
      positionSelectionFin: this.selFin,
      idZone: this.id,
      zoneEstEnFocus: true,
    };
  }

  static fromJson(jsonObject: any) {
    return new ZoneDeTexte(
      jsonObject.textEncoded,
      jsonObject.selectionStart,
      jsonObject.selectionEnd,
      jsonObject.idEncoded
    );
  }
}
