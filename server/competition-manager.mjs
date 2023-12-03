import EventEmitter from "events";
import Competition, {CompetitionEventName} from "./competition.mjs";
import {loadCompetition, log, logError, saveCompetition, saveCompetitionSummary, saveGame} from "./util.mjs";
import RobotsApi from "./robots-api.mjs";
import WebSocket, {WebSocketServer} from "ws";
import {Basket} from "./constants.mjs";

export const CompetitionManagerEventName = {
    competitionSaved: 'competitionSaved',
    competitionSummarySaved: 'competitionSummarySaved',
    competitionChanged: 'competitionChanged',
    gameChanged: 'gameChanged',
    competitionCreated: 'competitionCreated',
};

export default class CompetitionManager extends EventEmitter {
    /** @type {?Competition} */
    #competition = null;
    /** @type {string} */
    #competitionDirectory;

    #server;
    /** @type {RobotsApi} */
    #robotsApi;
    /** @type {number} */
    #robotsPort;
    /** @type {number} */
    #basketsPort;
    /** @type {number} */
    #refereePort;
    /** @type {WebSocketServer} */
    #wss;
    /** @type {WebSocketServer} */
    #wssBaskets;
    /** @type {WebSocketServer} */
    #wssReferee;

    get competition() {
        return this.#competition;
    }

    constructor(competitionDirectory, uiServer, robotsPort, basketsPort, refereePort) {
        super();
        this.#competitionDirectory = competitionDirectory;
        this.#server = uiServer;
        this.#robotsPort = robotsPort;
        this.#basketsPort = basketsPort;
        this.#refereePort = refereePort;

        this.#setup();
    }

    async createCompetition(id, name) {
        const competition = new Competition(id, name);

        this.#setCompetition(competition);

        await this.saveCompetition(competition, this.#competitionDirectory);

        this.emit(CompetitionManagerEventName.competitionCreated);
    }

    async saveCompetition() {
        await saveCompetition(this.#competition, this.#competitionDirectory);
        await this.saveCompetitionSummary();
        this.emit(CompetitionManagerEventName.competitionSaved);
    }

    async saveCompetitionSummary() {
        const competitionInfo = await saveCompetitionSummary(this.#competition, this.#competitionDirectory);
        this.emit(CompetitionManagerEventName.competitionSummarySaved, competitionInfo);
        this.#wsServerBroadcast(this.#wss, JSON.stringify({event: 'competition_summary', params: competitionInfo}));
    }

    #setup() {
        loadCompetition(this.#competitionDirectory)
            .then(competition => this.#setCompetition(competition))
            .catch(error => logError(error));

        this.#robotsApi = new RobotsApi(this.#robotsPort, (method, params) => {
            if (method === 'get_active_game_state') {
                const activeGame = this.#competition?.getActiveGame();

                if (!activeGame) {
                    return null;
                }

                const robotsIds = activeGame.getRobotIds();

                return {
                    is_running: activeGame.isRunning(),
                    targets: robotsIds,
                    baskets: activeGame.getBasketsForRobots(robotsIds),
                }
            }
        });

        this.#setupUIWebSocket();
        this.#setupBasketsWebSocket();
        this.#setupRefereeWebSocket();
    }

    #setupUIWebSocket() {
        this.#wss = new WebSocketServer({server: this.#server});

        this.#wss.on('connection', (ws, req) => {
            log('websocket connection', req.connection.remoteAddress, req.connection.remotePort);

            ws.on('message', (data, isBinary) => {
                const message = isBinary ? data : data.toString();

                log('received:', message);

                try {
                    this.#handleWsMessage(JSON.parse(message));
                } catch (error) {
                    logError(error);
                }
            });

            const activeGame = this.competition?.getActiveGame();

            if (activeGame) {
                ws.send(this.#getGameStateEventJSON(activeGame));
            }
        });
    }

    #setupBasketsWebSocket() {
        this.#wssBaskets = new WebSocketServer({port: this.#basketsPort}, () => {
            log('Opened baskets websocket');
        });

        this.#wssBaskets.on('connection', (ws, req) => {
            log('basket websocket connection', req.connection.remoteAddress, req.connection.remotePort);

            ws.on('message', (data, isBinary) => {
                const message = isBinary ? data : data.toString();

                log('basket sent:', message);

                if (message === 'blue') {
                    this.#incrementScore(Basket.blue);
                } else if (message === 'magenta') {
                    this.#incrementScore(Basket.magenta);
                }
            });
        });
    }

    #setupRefereeWebSocket() {
        this.#wssReferee = new WebSocketServer({port: this.#refereePort}, () => {
            log('Opened referee websocket');
        });

        this.#wssReferee.on('connection', (ws, req) => {
            log('referee websocket connection', req.connection.remoteAddress, req.connection.remotePort);

            ws.on('message', (data, isBinary) => {
                const message = isBinary ? data : data.toString();

                log('referee sent:', message);

                if (message === 'start_stop') {
                    const activeGame = this.#competition?.getActiveGame();

                    if (activeGame) {
                        if (activeGame.isRunning()) {
                            activeGame.stop();
                        } else {
                            activeGame.start();
                        }
                    } else {
                        log('No active games');
                    }
                }
            });
        });
    }

    #setCompetition(competition) {
        if (this.#competition === null) {
            this.#competition = competition;

            this.#competition.on(CompetitionEventName.changed, () => this.#handleCompetitionChanged());

            this.#competition.on(CompetitionEventName.gameChanged, (changeType, game) => this.#handleGameChanged(changeType, game));

            this.#competition.proceed();
        }
    }

    async #handleCompetitionChanged() {
        log('handleCompetitionChanged');
        await this.saveCompetition(this.#competition, this.#competitionDirectory);
        this.emit(CompetitionManagerEventName.competitionChanged);
    }

    async #handleGameChanged(changeType, game) {
        log('handleGameChanged');
        this.#broadcastGameState(game);
        this.#handleGameChangeType(changeType, game);
        await saveGame(game, this.#competitionDirectory);
        await this.saveCompetitionSummary(this.#competition, this.#competitionDirectory);
        this.emit(CompetitionManagerEventName.gameChanged, changeType, game);
    }

    #handleGameChangeType(changeType, game) {
        log('handleChangeType', changeType);

        if (changeType === 'roundStarted' || changeType === 'freeThrowAttemptStarted') {
            //playAudio('audio/whistle_blow_short.mp3');

            const targets = game.getInGameRobotIds();
            this.#robotsApi.start(targets, game.getBasketsForRobots(targets), 500);

        } else if (changeType === 'roundStopped' || changeType === 'freeThrowAttemptEnded') {
            //playAudio('audio/whistle_blow_long.mp3');
            this.#robotsApi.stop(game.getRobotIds(), 500);

        }/* else if (changeType === 'roundEnded') {
            playAudio('audio/basketball_buzzer.mp3');
        }*/

        this.#wsServerBroadcast(this.#wss, JSON.stringify({event: 'game_state_change', params: {type: changeType, id: game.id}}));
    }

    #wsServerBroadcast(wss, data) {
        wss.clients.forEach(function each(client) {
            if (client.readyState === WebSocket.OPEN) {
                client.send(data);
            }
        });
    }

    #broadcastGameState(game) {
        log('broadcastGameState');
        this.#wsServerBroadcast(this.#wss, this.#getGameStateEventJSON(game));
    }

    #getGameStateEventJSON(game) {
        return JSON.stringify({event: 'game_state', params: game && game.getInfo()})
    }

    #handleWsMessage(message) {
        log('handleWsMessage', message);

        const activeGame = this.#competition.getActiveGame();
        const gameID = message.params.gameID;
        const game = this.#competition.getGame(gameID);

        if (!game) {
            log(`Game (id = ${game.id}) not found`);
            return;
        }

        if (game.hasEnded) {
            log(`Game (id = ${game.id}) has ended`);
            return;
        }

        if (activeGame && activeGame.id !== game.id && !activeGame.hasEnded) {
            log(`Another game (id = ${game.id}) already active`);
            return;
        }

        if (!activeGame || activeGame.hasEnded) {
            this.#competition.setActiveGame(gameID);
        }

        if (this.#competition.getActiveGame().id !== gameID) {
            log(`Game (id = ${game.id}) not active`);
            return;
        }

        switch (message.method) {
            case 'set_active':
                const activeGame = this.competition?.getActiveGame();

                if (activeGame.id === game.id) {
                    this.#broadcastGameState(game)
                }
                break;
            case 'start_game':
                game.start();
                break;
            case 'stop_game':
                game.stop()
                break;
            case 'end_round':
                game.endRound();
                break;
            case 'increment_blue':
                game.incrementScore(Basket.blue);
                break;
            case 'increment_magenta':
                game.incrementScore(Basket.magenta);
                break;
            case 'increment_fouls_left':
                game.incrementFouls(0);
                break;
            case 'increment_fouls_right':
                game.incrementFouls(1);
                break;
            case 'confirm_game':
                game.confirm();
                break;
            case 'set_score_validity':
                const {sideIndex, scoreIndex, isValid} = message.params;
                game.setScoreValidity(sideIndex, scoreIndex, isValid);
                break;
        }
    }

    #incrementScore(basket) {
        const activeGame = this.#competition?.getActiveGame();

        if (!activeGame || activeGame.hasEnded) {
            return;
        }

        activeGame.incrementScore(basket);
    }

    manualStart(targets, baskets) {
        this.#robotsApi.start(targets, baskets);
    }

    manualStop(targets) {
        this.#robotsApi.stop(targets);
    }
}