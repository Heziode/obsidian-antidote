import WebSocket from 'ws';
import * as agTexteur from './InterfaceAgentTexteur';
import { readPreference } from './Preferences';
import { regReader } from './Registry';
import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import { existsSync, PathLike } from 'fs';

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

function aRecuToutLesPaquets(
  laListe: Array<string>,
  _leNombrePaquet: number
): boolean {
  for (let item of laListe) {
    if (item.length == 0) return false;
  }
  return true;
}

export class AgentConnectix {
  private prefs: any;
  private ws: WebSocket;
  private monAgent: agTexteur.AgentTexteur | undefined;
  private estInit: boolean;
  private initialisation: Promise<boolean> | undefined;

  private listePaquetsRecu: Array<string>;

  constructor(agent: agTexteur.AgentTexteur) {
    this.monAgent = agent;
    this.prefs = {} as JSON;
    this.ws = {} as WebSocket;
    this.listePaquetsRecu = new Array(0);
    this.estInit = false;
    this.initialisation = undefined;
  }

  async Initialise() {
    if (this.estInit) return true;

    // Two commands fired in a row must share the same attempt, otherwise each
    // of them starts its own agent and its own connection.
    if (this.initialisation === undefined) {
      this.initialisation = this.ObtiensReglages();
    }

    try {
      let retour = await this.initialisation;
      this.estInit = true;
      return retour;
    } finally {
      this.initialisation = undefined;
    }
  }

  LanceCorrecteur(): void {
    let laRequete = {
      message: 'LanceOutil',
      outilApi: 'Correcteur',
    };
    this.EnvoieMessage(JSON.stringify(laRequete));
  }

  LanceDictionnaire() {
    let laRequete = {
      message: 'LanceOutil',
      outilApi: 'Dictionnaires',
    };
    this.EnvoieMessage(JSON.stringify(laRequete));
  }

  LanceGuide() {
    let laRequete = {
      message: 'LanceOutil',
      outilApi: 'Guides',
    };
    this.EnvoieMessage(JSON.stringify(laRequete));
  }

  GereMessage(data: any) {
    let laReponse: any = {};
    laReponse.idMessage = data.idMessage;

    let message = data.message;
    if (message == 'init') {
      laReponse.titreDocument = this.monAgent?.DonneTitreDocument();
      laReponse.retourChariot = this.monAgent?.DonneRetourDeCharriot();
      laReponse.filtreActif = this.monAgent?.DonneTypeDocument();
      laReponse.permetRetourChariot = this.monAgent?.PermetsRetourDeCharriot();
      laReponse.permetEspaceInsecable = this.monAgent?.JeTraiteLesInsecables();
      laReponse.permetEspaceFin = this.monAgent?.EspaceFineDisponible();
      laReponse.remplaceSansSelection = true;
      this.EnvoieMessage(JSON.stringify(laReponse));
    } else if (data.message == 'cheminDocument') {
      laReponse.donnee = !this.monAgent?.DonneCheminDocument();
      this.EnvoieMessage(JSON.stringify(laReponse));
    } else if (data.message == 'donneZonesTexte') {
      this.monAgent?.DonneLesZonesACorriger().then((lesZones) => {
        let lesZonesEnJSON: agTexteur.ZoneDeTexteJSONAPI[] = new Array();

        lesZones?.forEach((element) => {
          lesZonesEnJSON.push(element.toJsonAPI());
        });
        laReponse.donnees = lesZonesEnJSON;
        this.EnvoieMessage(JSON.stringify(laReponse));
      });
    } else if (data.message == 'docEstDisponible') {
      laReponse.donnees = this.monAgent?.DocEstDisponible();

      this.EnvoieMessage(JSON.stringify(laReponse));
    } else if (data.message == 'editionPossible') {
      let idZone: string = data.donnees.idZone;
      let chaine: string = data.donnees.contexte;
      let debut: number = data.donnees.positionDebut;
      let fin: number = data.donnees.positionFin;

      laReponse.donnees = this.monAgent?.PeutCorriger(
        idZone,
        debut,
        fin,
        chaine
      );
      this.EnvoieMessage(JSON.stringify(laReponse));
    } else if (data.message == 'remplace') {
      let idZone: string = data.donnees.idZone;
      let chaine: string = data.donnees.nouvelleChaine;
      let debut: number = data.donnees.positionRemplacementDebut;
      let fin: number = data.donnees.positionRemplacementFin;

      this.monAgent
        ?.CorrigeDansTexteur(idZone, debut, fin, chaine, false)
        .then(() => {
          this.monAgent?.MetsFocusSurLeDocument();
          laReponse.donnees = true;
          this.EnvoieMessage(JSON.stringify(laReponse));
        });
    } else if (data.message == 'selectionne') {
      let idZone: string = data.donnees.idZone;
      let debut: number = data.donnees.positionDebut;
      let fin: number = data.donnees.positionFin;

      this.monAgent?.SelectionneIntervalle(idZone, debut, fin);
    } else if (data.message == 'retourneAuDocument') {
      this.monAgent?.RetourneAuTexteur();
    }
  }

  private async DonnePathAgentConsole() {
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
      let retour = regReader(
        'HKEY_LOCAL_MACHINE\\SOFTWARE\\Druide informatique inc.\\Connectix',
        'DossierConnectix'
      );
      return retour + 'AgentConnectixConsole.exe';
    }
    return '';
  }

  private async InitWS() {
    let lePortWS = this.prefs.port;
    this.ws = new WebSocket('ws://127.0.0.1:' + lePortWS);
    let moiMeme = this;
    this.ws.on('message', (data: any) => {
      moiMeme.RecoisMessage(data);
    });
    this.ws.on('close', () => {
      moiMeme.estInit = false;
    });
    let Promesse = new Promise<boolean>((resolve, reject) => {
      this.ws.on('open', () => {
        resolve(true);
      });
      this.ws.on('error', (error) => {
        moiMeme.estInit = false;
        reject(error);
      });
    });
    let retour = await Promesse;
    return retour;
  }

  private Digere(data: any) {
    if ('idPaquet' in data) {
      let lesDonnees: string = data.donnees;
      let leNombrePaquet: number = data.totalPaquet;
      let leNumeroPaquet: number = data.idPaquet;

      if (this.listePaquetsRecu.length < leNombrePaquet) {
        this.listePaquetsRecu = new Array(leNombrePaquet);
      }

      this.listePaquetsRecu[leNumeroPaquet - 1] = lesDonnees;

      if (aRecuToutLesPaquets(this.listePaquetsRecu, leNombrePaquet)) {
        let leMessageStr: string = this.listePaquetsRecu.join('');
        this.listePaquetsRecu = new Array(0);
        this.GereMessage(JSON.parse(leMessageStr));
      }
    } else {
      this.GereMessage(data);
    }
  }

  private RecoisMessage(data: any) {
    let leMsg = JSON.parse(data);
    this.Digere(leMsg);
  }

  private EnvoiePaquet(paquet: string) {
    if (this.ws.readyState == this.ws.OPEN) {
      this.ws.send(paquet);
    }
  }

  private EnvoieMessage(msg: string) {
    let laRequete = {
      idPaquet: 0,
      totalPaquet: 1,
      donnees: msg,
    };

    this.EnvoiePaquet(JSON.stringify(laRequete));
  }

  private async ObtiensReglages() {
    let path = await this.DonnePathAgentConsole();
    if (path === '' || !existsSync(path as PathLike)) {
      throw Error('Connectix Agent not found');
    }

    let AgentConsole = spawn(path, ['--api']);
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
        clearTimeout(laMinuterie);
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
        let debut = laSortie.indexOf('{');
        if (debut === -1) return;

        let lesReglages: ReglagesAgent;
        try {
          lesReglages = JSON.parse(laSortie.substring(debut));
        } catch (e) {
          // The answer is truncated: wait for the rest of it.
          return;
        }
        Reussi(lesReglages);
      };

      const SurErreur = (donnees: Buffer) => {
        lesErreurs += donnees.toString('utf8');
      };

      const laMinuterie = setTimeout(
        () => Echoue(Error('Connectix Agent did not answer')),
        DELAI_REPONSE_AGENT_MS
      );

      AgentConsole.stdout.on('data', SurSortie);
      AgentConsole.stderr.on('data', SurErreur);
      AgentConsole.on('error', Echoue);
      AgentConsole.stdin.on('error', Echoue);
      AgentConsole.on('close', (code: number | null) => {
        let laRaison = lesErreurs.trim();
        Echoue(
          Error(
            `Connectix Agent stopped before answering (code ${code})` +
              (laRaison === '' ? '' : `: ${laRaison}`)
          )
        );
      });

      AgentConsole.stdin.write('API');
    });
  }
}
