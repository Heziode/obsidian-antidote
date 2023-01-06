import WebSocket from 'ws';
import * as agTexteur from './InterfaceAgentTexteur';
import { regReader } from './Registry';
import { existsSync, PathLike } from 'fs';

function aRecuToutLesPaquets(
  laListe: Array<string>,
  _leNombrePaquet: number
): boolean {
  for (let item of laListe) {
    if (item.length == 0) return false;
  }
  return true;
}

interface TextData {
  texte: string;
  debutSelection: number;
  finSelection: number;
}

export function MetsTextePourOutilsDansJSON(
  jsonObject: any,
  textData: TextData
) {
  jsonObject.textEncoded = Buffer.from(textData.texte).toString('base64');
  jsonObject.selectionStart = textData.debutSelection;
  jsonObject.selectionEnd = textData.finSelection;
}

const TAILLE_MAX_MESSAGE = 3000;

export class AgentConnectix {
  private nomTexteur: string;
  private prefs: any;
  private ws: WebSocket;
  private monAgent: agTexteur.AgentTexteur | undefined;
  private estInit: boolean;

  private listePaquetsRecu: Array<string>;

  constructor(nomTexteur: string, agent: agTexteur.AgentTexteur) {
    console.log('constructeur de AgentConnectix:', nomTexteur, agent);

    this.nomTexteur = nomTexteur;
    this.monAgent = agent;
    this.prefs = {} as JSON;
    this.ws = {} as WebSocket;
    this.listePaquetsRecu = new Array(0);
    this.estInit = false;
  }

  async Initialise() {
    if (this.estInit) return true;
    let retour = await this.ObtiensReglages();
    this.monAgent?.Initialise();
    this.estInit = true;
    return retour;
  }

  LanceCorrecteur(): void {
    // let laRequete = {
    //   message: 'LanceOutil',
    //   outilApi: 'Correcteur',
    // };

    let laRequete = {
      _dib101: 'PluginTexteur',
      _dib81: this.monAgent ? this.monAgent.DonneIdWSExpediteur() : undefined,
      _dib105: 'requete',
      _dib106: !0,
      message: 'LanceOutil',
      outilApi: 'Correcteur',
      _dib79: this.monAgent ? this.monAgent.DonneTitreDocument() : undefined,
      _dib75: this.monAgent ? this.monAgent.DonneTitreDocument() : undefined,
      nomExpediteur: this.monAgent
        ? this.monAgent.DonneNomExpediteur()
        : undefined,
      versionPont: '2.0',
      versionIATMin: '1.0',
      versionIATMax: '1.1',
    };

    this.EnvoieMessage(JSON.stringify(laRequete));
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

  RepondARequeteTextePourOutils(data: any, textData: TextData) {
    var t;
    (data._dib105 = 'reponse'),
      MetsTextePourOutilsDansJSON(data, textData),
      (data._dib81 =
        null === (t = this.monAgent) || void 0 === t
          ? void 0
          : t.DonneIdWSExpediteur()),
      this.EnvoieMessage(JSON.stringify(data));
  }

  GereMessage(data: any) {
    let message = data.message;
    if (message === 'donneTextePourOutils') {
      this.monAgent?.DonneSelectionDansSonContexte().then((selection) => {
        this.RepondARequeteTextePourOutils(data, selection);
      });
    } else if (message === 'remplaceEtReselectionne') {
      let texte = Buffer.from(data._dib37, 'base64').toString();
      this.monAgent?.DonneDebutSelection().then((debutSelection) => {
        this.monAgent?.RemplaceMot(texte).then(() => {
          this.monAgent?.SelectionneIntervalle(
            '',
            debutSelection,
            debutSelection + texte.length
          );
        });
      }),
        this.monAgent?.MetsFocusSurLeDocument();
    } else if (message === '_pb2d') {
      let estMort = this.monAgent?.DocEstMort();
      this.RepondARequete(data, estMort);
    } else if (message === '_pb15d') {
      let idCommunication = Buffer.from(data._dib99, 'base64').toString(),
        selection = Buffer.from(data._dib37, 'base64').toString(),
        debutSelection = data._dib49,
        finSelection = data._dib50;
      this.RepondARequete(
        data,
        this.monAgent?.PeutCorriger(
          idCommunication,
          debutSelection,
          finSelection,
          selection
        )
      );
    } else if (message === 'CorrigeAvecContexte') {
      const leIDZone = Buffer.from(data._dib99, 'base64').toString();
      const debutAncienTexte = data._dib49;
      const finAncienTexte = data._dib50;
      const nouveauTexte = Buffer.from(data._dib37, 'base64').toString();
      const contexte = Buffer.from(data._dib92, 'base64').toString();
      const debutContexte = data.debutContexte;
      const finContexte = data.finContexte;
      const ignorerMajuscule = false;

      if (
        this.monAgent?.PeutCorriger(
          leIDZone,
          debutContexte,
          finContexte,
          contexte
        )
      ) {
        this.monAgent
          ?.CorrigeDansTexteur(
            leIDZone,
            debutAncienTexte,
            finAncienTexte,
            nouveauTexte,
            ignorerMajuscule
          )
          .then((aReussi) => {
            this.monAgent?.MetsFocusSurLeDocument();
            this.RepondARequete(data, aReussi);
          });
      } else {
        this.RepondARequete(data, false);
      }
    } else if (message === '_pb1d') {
      const erreur = Buffer.from(data._dib99, 'base64').toString(),
        debutErreur = data._dib49,
        finErreur = data._dib50,
        suggestion = Buffer.from(data._dib37, 'base64').toString(),
        ignorerMajuscule = false;
      if (
        this.monAgent?.PeutCorriger(erreur, debutErreur, finErreur, suggestion)
      ) {
        this.monAgent
          .CorrigeDansTexteur(
            erreur,
            debutErreur,
            finErreur,
            suggestion,
            ignorerMajuscule
          )
          .then((resultat) => {
            this.monAgent?.MetsFocusSurLeDocument();
            this.RepondARequete(data, resultat);
          });
      } else {
        this.RepondARequete(data, false);
      }
    } else if ('_pb12d' == message) {
      this.monAgent?.InitPourOutils(true);
      this.RepondAInitialise(data, true);
    } else if ('_pb10d' == message) {
      this.monAgent?.InitPourCorrecteur();
      this.RepondAInitialise(data, true);
    } else if ('_pb11d' == message) {
      this.monAgent?.InitPourOutils(true);
      this.RepondAInitialise(data, true);
    } else if ('_pb16d' == message) {
      const texte = data._dib37;
      this.monAgent?.RemplaceMot(Buffer.from(texte, 'base64').toString());
    } else if ('_pb17d' == message) {
      this.monAgent?.RetourneAuTexteur();
    } else if ('_pb18d' == message) {
      this.monAgent?.RompsLienTexteur();
    } else if ('_pb19d' == message) {
      this.monAgent?.RompsLienCorrecteur();
    } else if (message === '_pb20d') {
      const nouveauTexte = data._dib53;
      this.monAgent?.SelectionneApresRemplace(nouveauTexte);
    } else if (message === '_pb21d') {
      const texte = Buffer.from(data._dib99, 'base64').toString(),
        debutSelection = data._dib49,
        finSelection = data._dib50;
      this.monAgent?.SelectionneIntervalle(texte, debutSelection, finSelection);
    } else {
      if (message === '_pb29d') {
        this.monAgent?.ReinitialisePourCorrecteur();
      } else if (message === '_pb36d') {
        this.monAgent?.DonneLesZonesACorriger().then((zones) => {
          const zonesJson = zones?.map((zone) => zone.toJson()) ?? [];
          this.RepondARequetePourZone(data, zonesJson);
        });
      } else if (
        message === '_pb28d' ||
        message === '_pb41d' ||
        message === 'DonneProgression'
      ) {
        this.RepondARequete(data, this.monAgent?.DonneProgression());
      } else if (message === 'donneImageTexteur') {
        this.RepondARequete(data);
      } else if (message === 'DonneCheminDocument') {
        this.RepondARequete(data, this.monAgent?.DonneCheminDocument());
      }
    }
  }

  RepondARequetePourZone(donneesDeReponse: any, typeDeRequete: any) {
    donneesDeReponse._dib105 = 'reponse';
    donneesDeReponse._dib100 = typeDeRequete;
    donneesDeReponse._dib81 = this.monAgent?.DonneIdWSExpediteur();
    this.EnvoieMessage(JSON.stringify(donneesDeReponse));
  }

  /**
   * TODO: to be deleted
   * @param data
   */
  private GereMessageOld(data: any) {
    let laReponse: any = {};
    laReponse.idMessage = data.idMessage;
    if (data.message == 'init') {
      laReponse.titreDocument = this.monAgent?.DonneTitreDocument();
      laReponse.retourChariot = this.monAgent?.DonneRetourDeCharriot();
      laReponse.permetRetourChariot = this.monAgent?.PermetsRetourDeCharriot();
      laReponse.permetEspaceInsecables = this.monAgent?.JeTraiteLesInsecables();
      laReponse.permetEspaceFin = this.monAgent?.EspaceFineDisponible();
      laReponse.remplaceSansSelection = true;
      this.EnvoieMessage(JSON.stringify(laReponse));
    } else if (data.message == 'cheminDocument') {
      laReponse.donnee = !this.monAgent?.DonneCheminDocument();
      this.EnvoieMessage(JSON.stringify(laReponse));
    } else if (data.message == 'docEstDisponible') {
      laReponse.donnees = this.monAgent?.DocEstDisponible();

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
        .then((reponse) => {
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
    let lePortWS = this.prefs.noPort;
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
    if (Object.hasOwnProperty.call(data, '_dib83')) {
      let lesDonnees: string = data._dib84;
      let leNombrePaquet: number = data._dib85;
      let leNumeroPaquet: number = data._dib83;

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
    console.log('RecoisMessage: ', leMsg);

    this.Digere(leMsg);
  }

  private EnvoiePaquet(paquet: string) {
    if (this.ws.readyState == this.ws.OPEN) {
      console.log('EnvoiePaquet: ', JSON.parse(paquet));

      this.ws.send(paquet);
    }
  }

  RepondARequete(data: any, requestType?: any) {
    data._dib105 = 'reponse';
    data._dib29 = requestType;
    data._dib81 = this.monAgent
      ? this.monAgent.DonneIdWSExpediteur()
      : undefined;
    this.EnvoieMessage(JSON.stringify(data));
  }

  RepondAInitialise(responseData: any, requestType: any) {
    responseData._dib105 = 'reponse';
    responseData._dib29 = requestType;
    responseData._dib75 = this.monAgent
      ? Buffer.from(this.monAgent.DonneTitreDocument()).toString('base64')
      : undefined;
    responseData._dib77 = this.monAgent
      ? Buffer.from(this.monAgent.DonneRetourDeCharriot()).toString('base64')
      : undefined;
    responseData._dib78 = this.monAgent
      ? this.monAgent.PermetsRetourDeCharriot()
      : undefined;
    responseData._dib68 = this.monAgent
      ? this.monAgent.EspaceFineDisponible()
      : undefined;
    responseData._dib72 = this.monAgent
      ? this.monAgent.JeTraiteLesInsecables()
      : undefined;
    responseData._dib93 = true;
    responseData._dib81 = this.monAgent
      ? this.monAgent.DonneIdWSExpediteur()
      : undefined;
    this.EnvoieMessage(JSON.stringify(responseData));
  }

  private EnvoieMessage(msg: string) {
    // let laRequete = {
    //   idPaquet: 0,
    //   totalPaquet: 1,
    //   donnees: msg,
    // };

    // this.EnvoiePaquet(JSON.stringify(laRequete));

    let msgSize = msg.length;
    if (msgSize > TAILLE_MAX_MESSAGE) {
      let msgBase64 = Buffer.from(msg).toString('base64');
      msgSize = msgBase64.length;
      let tailleTraitée = 0;
      let packetNumber = 1;
      let messageObj = {
        _dib83: 999,
        _dib85: 999,
        versionPont: 1.1,
        _dib84: '',
      };
      let messageStr = JSON.stringify(messageObj);
      let tailleMessage = TAILLE_MAX_MESSAGE - (messageStr.length + 10);
      let nombreDePaquets = Math.ceil(msgSize / tailleMessage);
      do {
        messageObj = {
          _dib83: packetNumber,
          _dib85: nombreDePaquets,
          versionPont: 1.1,
          _dib84: '',
        };
        messageStr = JSON.stringify(messageObj);
        let tailleMessageRestant = msgSize - tailleTraitée;
        let tailleMessageRestantPropre =
          tailleMessageRestant > tailleMessage
            ? tailleMessage
            : tailleMessageRestant;

        if (tailleMessageRestantPropre > 0) {
          messageObj._dib84 = msgBase64.substring(
            tailleTraitée,
            tailleTraitée + tailleMessageRestantPropre
          );
        }

        this.EnvoiePaquet(JSON.stringify(messageObj));
        tailleTraitée += tailleMessageRestantPropre;
        packetNumber += 1;
      } while (tailleTraitée <= msgSize && packetNumber <= nombreDePaquets);
    } else this.EnvoiePaquet(msg);
  }

  private async ObtiensReglages() {
    let path = await this.DonnePathAgentConsole();
    if (!existsSync(path as PathLike)) {
      throw Error('Connectix Agent not found');
    }
    console.log('path: ', path);

    let AgentConsole = require('child_process').spawn(path);

    let Promesse = new Promise<boolean>((resolve) => {
      AgentConsole.stdout.on('data', (data: any) => {
        let str: string = data.toString('utf8');
        str = str.substring(str.indexOf('{'), str.length);

        if (str === '{}') {
          console.log('this.nomTexteur: ', this.nomTexteur);

          AgentConsole.stdin.write(this.nomTexteur);
        } else {
          this.prefs = JSON.parse(str);
          console.log('prefs: ', this.prefs);

          this.InitWS().then((retour) => {
            resolve(retour);
          });
        }
      });
    });
    AgentConsole.stdin.write(this.nomTexteur);
    let retour = await Promesse;
    return retour;
  }
}
