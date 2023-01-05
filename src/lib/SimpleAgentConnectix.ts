import WebSocket from 'ws';
import { regReader } from './Registry';
import { existsSync, PathLike } from 'fs';

function aRecuToutLesPaquets(laListe: Array<string>): boolean {
  for (let item of laListe) {
    if (item.length == 0) return false;
  }
  return true;
}

export class SimpleAgentConnectix {
  private prefs: any;
  private ws: WebSocket;
  private estInit: boolean;

  private listePaquetsRecu: Array<string>;

  constructor() {
    this.prefs = {} as JSON;
    this.ws = {} as WebSocket;
    this.listePaquetsRecu = new Array(0);
    this.estInit = false;
  }

  async Initialise() {
    if (this.estInit) return true;
    let retour = await this.ObtiensReglages();
    this.estInit = true;
    return retour;
  }

  LanceDictionnaire(): void {
    let laRequete = {
      message: 'LanceOutil',
      outilApi: 'Dictionnaires',
    };
    this.EnvoieMessage(JSON.stringify(laRequete));
  }

  LanceGuide(): void {
    let laRequete = {
      message: 'LanceOutil',
      outilApi: 'Guides',
    };
    this.EnvoieMessage(JSON.stringify(laRequete));
  }

  private GereMessage(data: any) {
    this.EnvoieMessage(JSON.stringify({ idMessage: data.idMessage }));
  }

  private async DonnePathAgentConsole() {
    if (process.platform === 'darwin') {
      const plist = require('bplist-parser');
      const homedir = require('os').homedir();
      let data;
      let xml = await plist.parseFile(
        homedir + '/Library/Preferences/com.druide.Connectix.plist'
      );
      data = xml[0].DossierApplication;
      return data + '/Contents/SharedSupport/AgentConnectixConsole';
    } else if (process.platform === 'linux')
      return '/usr/local/bin/AgentConnectixConsole';
    else if (process.platform === 'win32') {
      let retour = regReader(
        'HKEY_LOCAL_MACHINE\\SOFTWARE\\Druide informatique inc.\\Connectix',
        'DossierConnectix'
      );
      return retour + 'AgentConnectixConsole.exe';
    }
  }

  private async InitWS() {
    let lePortWS = this.prefs.port;
    this.ws = new WebSocket('ws://localhost:' + lePortWS);
    let moiMeme = this;
    this.ws.on('message', (data) => {
      moiMeme.RecoisMessage(data);
    });
    this.ws.on('close', () => {
      moiMeme.estInit = false;
    });
    this.ws.on('error', (data) => {
      moiMeme.estInit = false;
    });
    let Promesse = new Promise<boolean>((resolve) => {
      this.ws.on('open', () => {
        resolve(true);
      });
    });
    let retour = await Promesse;
    return retour;
  }

  private Digere(data: any) {
    if (Object.hasOwnProperty.call(data, 'idPaquet')) {
      let lesDonnees: string = data.donnees;
      let leNombrePaquet: number = data.totalPaquet;
      let leNumeroPaquet: number = data.idPaquet;

      if (this.listePaquetsRecu.length < leNombrePaquet)
        this.listePaquetsRecu = new Array(leNombrePaquet);

      this.listePaquetsRecu[leNumeroPaquet - 1] = lesDonnees;

      if (aRecuToutLesPaquets(this.listePaquetsRecu)) {
        let leMessageStr: string = this.listePaquetsRecu.join('');
        this.listePaquetsRecu = new Array(0);
        this.GereMessage(JSON.parse(leMessageStr));
      }
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
    if (!existsSync(path as PathLike)) {
      throw Error('Connectix Agent not found');
    }

    let Promesse = new Promise<boolean>((resolve) => {
      AgentConsole.stdout.on('data', (data: any) => {
        let str: String = data.toString('utf8');

        this.prefs = JSON.parse(str.substring(str.indexOf('{'), str.length));
        this.InitWS().then((retour) => {
          resolve(retour);
        });
      });
    });
    AgentConsole.stdin.write('API');
    let retour = await Promesse;
    return retour;
  }
}
