import EventEmitter from "events";
import Competition from "./competition.mjs";
import {loadCompetition, log, logError, saveCompetition, saveGame} from "./util.mjs";
import RobotsApi from "./robots-api.mjs";
import WebSocket from "ws";
import {Basket} from "./constants.mjs";

export default class CompetitionManager extends EventEmitter {
    #competition = null;
    #competitionDirectory;
    #server;
    #robotsApi;
    #basketsPort;
    #refereePort;
    #wss;
    #wssBaskets;
    #wssReferee;

    get competition() {
        return this.#competition;
    }

    constructor(competitionDirectory, uiServer, basketsPort, refereePort) {
        super();
        this.#competitionDirectory = competitionDirectory;
        this.#server = uiServer;
        this.#basketsPort = basketsPort;
        this.#refereePort = refereePort;

        this.#setup();
    }

    createCompetition(id, name) {
        const competition = new Competition(id, name);

        this.#setCompetition(competition);

        saveCompetition(competition, this.#competitionDirectory);
    }

    async saveCompetition() {
        await saveCompetition(this.#competition, this.#competitionDirectory);
    }

    #setup() {
        loadCompetition(this.#competitionDirectory)
            .then(competition => this.#setCompetition(competition))
            .catch(error => logError(error));

        this.#robotsApi = new RobotsApi(8111, (method, params) => {
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
        this.#wss = new WebSocket.Server({server: this.#server});

        this.#wss.on('connection', (ws, req) => {
            log('websocket connection', req.connection.remoteAddress, req.connection.remotePort);

            ws.on('message', (message) => {
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
        this.#wssBaskets = new WebSocket.Server({port: this.#basketsPort}, () => {
            log('Opened baskets websocket');
        });

        this.#wssBaskets.on('connection', (ws, req) => {
            log('basket websocket connection', req.connection.remoteAddress, req.connection.remotePort);

            ws.on('message', (message) => {
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
        this.#wssReferee = new WebSocket.Server({port: this.#refereePort}, () => {
            log('Opened referee websocket');
        });

        this.#wssReferee.on('connection', (ws, req) => {
            log('referee websocket connection', req.connection.remoteAddress, req.connection.remotePort);

            ws.on('message', (message) => {
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

            this.#competition.on('changed', () => this.#handleCompetitionChanged());

            this.#competition.on('gameChanged', (changeType, game) => this.#handleGameChanged(changeType, game));

            this.#competition.proceed();
        }
    }

    #handleCompetitionChanged() {
        log('handleCompetitionChanged');
        saveCompetition(this.#competition, this.#competitionDirectory);
    }

    #handleGameChanged(changeType, game) {
        log('handleGameChanged');
        this.#broadcastGameState(game);
        this.#handleGameChangeType(changeType, game);
        saveGame(game, this.#competitionDirectory);
    }

    #handleGameChangeType(changeType, game) {
        log('handleChangeType', changeType);

        if (changeType === 'roundStarted' || changeType === 'freeThrowAttemptStarted') {
            //playAudio('audio/whistle_blow_short.mp3');

            const targets = game.getInGameRobotIds();
            this.#robotsApi.start(targets, game.getBasketsForRobots(targets));

        } else if (changeType === 'roundStopped' || changeType === 'freeThrowAttemptEnded') {
            //playAudio('audio/whistle_blow_long.mp3');
            this.#robotsApi.stop(game.getRobotIds());

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
}