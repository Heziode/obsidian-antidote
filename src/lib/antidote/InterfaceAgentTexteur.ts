export abstract class AgentTexteur {

  //Information sur le texteur
  abstract DonneRetourDeCharriot(): string;
  abstract DonneTitreDocument(): string;
  abstract DonneCheminDocument(): string;
  EspaceFineDisponible(): boolean { return false; }
  JeTraiteLesInsecables(): boolean { return true; };
  abstract PermetsRetourDeCharriot(): boolean;

  // Requête d'Antidote
  abstract DonneLesZonesACorriger(): Promise<ZoneDeTexte[]>;
  abstract PeutCorriger(leIDZone: string, debut: number, fin: number, laChaineOrig: string): boolean;
  abstract DocEstDisponible(): boolean;


  // Actions requises depuis Antidote
  abstract CorrigeDansTexteur(leIDZone: string, leDebut: number, laFin: number, laChaine: string, automatique: boolean): Promise<boolean>;
  abstract RetourneAuTexteur(): void;
  abstract MetsFocusSurLeDocument(): void;
  abstract SelectionneIntervalle(leIDZone: string, debut: number, fin: number): void;

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

  constructor(leTexte: string, selectionDebut?: number, selectionFin?: number, guid?: string) {
    this.texte = leTexte;
    if (selectionDebut)
      this.selDebut = selectionDebut;
    else
      this.selDebut = 0;

    if (selectionFin)
      this.selFin = selectionFin;
    else
      this.selFin = 0;

    if (this.selFin < this.selDebut)
      [this.selFin, this.selDebut] = [this.selDebut, this.selFin];
    if (guid)
      this.id = guid;
    else
      this.id = "";
  }

  toJsonAPI(): ZoneDeTexteJSONAPI {
    return { texte: this.texte, positionSelectionDebut: this.selDebut, positionSelectionFin: this.selFin, idZone: this.id, zoneEstEnFocus: true };
  }
}