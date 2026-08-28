import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import { existsSync } from 'fs';

import WebSocket from 'ws';

import * as agTexteur from './InterfaceAgentTexteur';
import { readPreference } from './Preferences';
import { regReader } from './Registry';

/**
 * The console agent answers its settings as soon as it is asked. Past that
 * delay it never will, and waiting any longer would leave the command hanging
 * without ever telling the user that something went wrong.
 */
const DELAI_REPONSE_AGENT_MS = 10000;

/** Settings answered by the console agent. Only the WebSocket port is used. */
interface ReglagesAgent {
  port: number;
}

/**
 * Envelope every message travels in. A payload too large for a single frame is
 * cut into `totalPaquet` packets, numbered from one.
 */
interface PaquetConnectix {
  idPaquet: number;
  totalPaquet: number;
  donnees: string;
}

/** Fields carried by a request, each one specific to the message it belongs to. */
interface DonneesRequete {
  contexte?: string;
  idZone?: string;
  nouvelleChaine?: string;
  positionDebut?: number;
  positionFin?: number;
  positionRemplacementDebut?: number;
  positionRemplacementFin?: number;
}

/** A request coming from Antidote, once reassembled. */
interface RequeteConnectix {
  donnees?: DonneesRequete;
  idMessage?: number;
  message?: string;
}

/** The answer to a request. Every field but `idMessage` is message specific. */
interface ReponseConnectix {
  donnee?: boolean;
  donnees?: agTexteur.ZoneDeTexteJSONAPI[] | boolean;
  filtreActif?: agTexteur.typeDocument;
  idMessage?: number;
  permetEspaceFin?: boolean;
  permetEspaceInsecable?: boolean;
  permetRetourChariot?: boolean;
  remplaceSansSelection?: boolean;
  retourChariot?: string;
  titreDocument?: string;
}

/** An order to bring one of the Antidote tools up. */
interface RequeteLanceOutil {
  message: 'LanceOutil';
  outilApi: 'Correcteur' | 'Dictionnaires' | 'Guides';
}

/**
 * The console agent is nowhere to be found. Antidote and its Connectix agent
 * are most likely not installed, which is a different problem from an agent
 * that is there but refuses to talk.
 */
export class AgentIntrouvable extends Error {}

/**
 * Read a frame as text. A frame normally arrives as a `Buffer`, but `ws` also
 * hands out array buffers and buffer slices, whose default stringification is
 * `[object ArrayBuffer]` rather than the payload they carry.
 */
function DecodeTrame(data: WebSocket.RawData): string {
  if (Array.isArray(data)) return Buffer.concat(data).toString('utf8');
  if (Buffer.isBuffer(data)) return data.toString('utf8');
  return Buffer.from(data).toString('utf8');
}

function aRecuToutLesPaquets(laListe: string[]): boolean {
  for (const item of laListe) {
    if (item.length == 0) return false;
  }
  return true;
}

export class AgentConnectix {
  private prefs: ReglagesAgent;
  private ws: WebSocket | undefined;
  private monAgent: agTexteur.AgentTexteur | undefined;
  private estInit: boolean;
  private initialisation: Promise<boolean> | undefined;

  private listePaquetsRecu: string[];

  constructor(agent: agTexteur.AgentTexteur) {
    this.monAgent = agent;
    this.prefs = { port: 0 };
    this.ws = undefined;
    this.listePaquetsRecu = [];
    this.estInit = false;
    this.initialisation = undefined;
  }

  async Initialise(): Promise<boolean> {
    if (this.estInit) return true;

    // Two commands fired in a row must share the same attempt, otherwise each
    // of them starts its own agent and its own connection.
    if (this.initialisation === undefined) {
      this.initialisation = this.ObtiensReglages();
    }

    try {
      const retour = await this.initialisation;
      this.estInit = true;
      return retour;
    } finally {
      this.initialisation = undefined;
    }
  }

  LanceCorrecteur(): void {
    this.LanceOutil('Correcteur');
  }

  LanceDictionnaire(): void {
    this.LanceOutil('Dictionnaires');
  }

  LanceGuide(): void {
    this.LanceOutil('Guides');
  }

  private LanceOutil(outilApi: RequeteLanceOutil['outilApi']): void {
    const laRequete: RequeteLanceOutil = { message: 'LanceOutil', outilApi };
    this.EnvoieMessage(JSON.stringify(laRequete));
  }

  GereMessage(data: RequeteConnectix): void {
    const idMessage = data.idMessage;
    const donnees = data.donnees;

    switch (data.message) {
      case 'init':
        this.EnvoieReponse({
          idMessage,
          titreDocument: this.monAgent?.DonneTitreDocument(),
          retourChariot: this.monAgent?.DonneRetourDeCharriot(),
          filtreActif: this.monAgent?.DonneTypeDocument(),
          permetRetourChariot: this.monAgent?.PermetsRetourDeCharriot(),
          permetEspaceInsecable: this.monAgent?.JeTraiteLesInsecables(),
          permetEspaceFin: this.monAgent?.EspaceFineDisponible(),
          remplaceSansSelection: true,
        });
        break;

      case 'cheminDocument':
        this.EnvoieReponse({
          idMessage,
          donnee: !this.monAgent?.DonneCheminDocument(),
        });
        break;

      case 'donneZonesTexte':
        this.monAgent
          ?.DonneLesZonesACorriger()
          .then((lesZones) => {
            this.EnvoieReponse({
              idMessage,
              donnees: lesZones.map((zone) => zone.toJsonAPI()),
            });
          })
          .catch((e: unknown) => {
            console.error(e);
          });
        break;

      case 'docEstDisponible':
        this.EnvoieReponse({
          idMessage,
          donnees: this.monAgent?.DocEstDisponible(),
        });
        break;

      case 'editionPossible':
        this.EnvoieReponse({
          idMessage,
          donnees: this.monAgent?.PeutCorriger(
            donnees?.idZone ?? '',
            donnees?.positionDebut ?? 0,
            donnees?.positionFin ?? 0,
            donnees?.contexte ?? ''
          ),
        });
        break;

      case 'remplace':
        this.monAgent
          ?.CorrigeDansTexteur(
            donnees?.idZone ?? '',
            donnees?.positionRemplacementDebut ?? 0,
            donnees?.positionRemplacementFin ?? 0,
            donnees?.nouvelleChaine ?? '',
            false
          )
          .then(() => {
            this.monAgent?.MetsFocusSurLeDocument();
            this.EnvoieReponse({ idMessage, donnees: true });
          })
          .catch((e: unknown) => {
            console.error(e);
          });
        break;

      case 'selectionne':
        this.monAgent?.SelectionneIntervalle(
          donnees?.idZone ?? '',
          donnees?.positionDebut ?? 0,
          donnees?.positionFin ?? 0
        );
        break;

      case 'retourneAuDocument':
        this.monAgent?.RetourneAuTexteur();
        break;
    }
  }

  private async DonnePathAgentConsole(): Promise<string> {
    if (process.platform === 'darwin') {
      const dossierApplication = await readPreference(
        'com.druide.Connectix',
        'DossierApplication'
      );
      if (dossierApplication === '') return '';
      return (
        dossierApplication + '/Contents/SharedSupport/AgentConnectixConsole'
      );
    } else if (process.platform === 'linux')
      return '/usr/local/bin/AgentConnectixConsole';
    else if (process.platform === 'win32') {
      const retour = regReader(
        'HKEY_LOCAL_MACHINE\\SOFTWARE\\Druide informatique inc.\\Connectix',
        'DossierConnectix'
      );
      return retour + 'AgentConnectixConsole.exe';
    }
    return '';
  }

  private InitWS(): Promise<boolean> {
    const ws = new WebSocket('ws://127.0.0.1:' + String(this.prefs.port));
    this.ws = ws;

    ws.on('message', (data) => {
      this.RecoisMessage(data);
    });
    ws.on('close', () => {
      this.estInit = false;
    });

    return new Promise<boolean>((resolve, reject) => {
      ws.on('open', () => {
        resolve(true);
      });
      ws.on('error', (error) => {
        this.estInit = false;
        reject(error);
      });
    });
  }

  private Digere(data: unknown): void {
    if (typeof data !== 'object' || data === null) return;

    if (!('idPaquet' in data)) {
      this.GereMessage(data);
      return;
    }

    const paquet = data as PaquetConnectix;

    if (this.listePaquetsRecu.length < paquet.totalPaquet) {
      // Filled rather than left sparse: a hole reads back as `undefined`, which
      // the completeness check below cannot measure.
      this.listePaquetsRecu = new Array<string>(paquet.totalPaquet).fill('');
    }

    this.listePaquetsRecu[paquet.idPaquet - 1] = paquet.donnees;

    if (!aRecuToutLesPaquets(this.listePaquetsRecu)) return;

    const leMessageStr: string = this.listePaquetsRecu.join('');
    this.listePaquetsRecu = [];

    const leMessage: unknown = JSON.parse(leMessageStr);
    this.GereMessage(leMessage as RequeteConnectix);
  }

  private RecoisMessage(data: WebSocket.RawData): void {
    const leMsg: unknown = JSON.parse(DecodeTrame(data));
    this.Digere(leMsg);
  }

  private EnvoiePaquet(paquet: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(paquet);
    }
  }

  private EnvoieMessage(msg: string): void {
    const laRequete: PaquetConnectix = {
      idPaquet: 0,
      totalPaquet: 1,
      donnees: msg,
    };

    this.EnvoiePaquet(JSON.stringify(laRequete));
  }

  private EnvoieReponse(reponse: ReponseConnectix): void {
    this.EnvoieMessage(JSON.stringify(reponse));
  }

  private async ObtiensReglages(): Promise<boolean> {
    const path = await this.DonnePathAgentConsole();
    if (path === '' || !existsSync(path)) {
      throw new AgentIntrouvable('Connectix Agent not found');
    }

    const AgentConsole = spawn(path, ['--api']);
    try {
      this.prefs = await this.LisReglagesAgent(AgentConsole);
    } catch (e) {
      // Nothing usable will ever come out of that agent: do not leave it behind.
      AgentConsole.kill();
      throw e;
    }

    return this.InitWS();
  }

  /**
   * Ask the console agent for its settings, the WebSocket port among them.
   *
   * The answer is written on stdout and may be split over several chunks, so it
   * is accumulated until it parses. Every way the agent has to not answer -
   * refusing to start, dying, staying silent - rejects the promise, so that a
   * command never waits forever on an agent that will never reply.
   */
  private LisReglagesAgent(
    AgentConsole: ChildProcessWithoutNullStreams
  ): Promise<ReglagesAgent> {
    return new Promise((resolve, reject) => {
      let laSortie = '';
      let lesErreurs = '';
      let estTermine = false;

      const Termine = () => {
        estTermine = true;
        window.clearTimeout(laMinuterie);
        AgentConsole.stdout.removeListener('data', SurSortie);
        AgentConsole.stderr.removeListener('data', SurErreur);
      };

      const Reussi = (reglages: ReglagesAgent) => {
        if (estTermine) return;
        Termine();
        resolve(reglages);
      };

      const Echoue = (erreur: Error) => {
        if (estTermine) return;
        Termine();
        reject(erreur);
      };

      const SurSortie = (donnees: Buffer) => {
        laSortie += donnees.toString('utf8');
        const debut = laSortie.indexOf('{');
        if (debut === -1) return;

        let lesReglages: ReglagesAgent;
        try {
          lesReglages = JSON.parse(laSortie.substring(debut)) as ReglagesAgent;
        } catch {
          // The answer is truncated: wait for the rest of it.
          return;
        }
        Reussi(lesReglages);
      };

      const SurErreur = (donnees: Buffer) => {
        lesErreurs += donnees.toString('utf8');
      };

      const laMinuterie = window.setTimeout(
        () => Echoue(Error('Connectix Agent did not answer')),
        DELAI_REPONSE_AGENT_MS
      );

      AgentConsole.stdout.on('data', SurSortie);
      AgentConsole.stderr.on('data', SurErreur);
      AgentConsole.on('error', Echoue);
      AgentConsole.stdin.on('error', Echoue);
      AgentConsole.on('close', (code: number | null) => {
        const laRaison = lesErreurs.trim();
        Echoue(
          Error(
            `Connectix Agent stopped before answering (code ${String(code)})` +
              (laRaison === '' ? '' : `: ${laRaison}`)
          )
        );
      });

      AgentConsole.stdin.write('API');
    });
  }
}
