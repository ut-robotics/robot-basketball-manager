import WebsocketManager from "./util/websocket-manager.js";

export default class ServerWebsocketApi {
    constructor(gameID) {
        this.gameID = gameID;
        this.messageListeners = new Set();
        this.socketManager = new WebsocketManager(this.onSocketMessage.bind(this));
    }

    onSocketMessage(message) {
        this.dispatchMessage(message);
    }

    onMessage(listener) {
        this.messageListeners.add(listener);
    }

    offMessage(listener) {
        this.messageListeners.delete(listener);
    }

    dispatchMessage(message) {
        this.messageListeners.forEach((listener) => listener(message));
    }

    createGame(robotIDs) {
        this.socketManager.send({method: 'create_game', params: {robotIDs, gameID: this.gameID}});
    }

    setActive() {
        this.socketManager.send({method: 'set_active', params: {gameID: this.gameID}});
    }

    start() {
        this.socketManager.send({method: 'start_game', params: {gameID: this.gameID}});
    }

    stop() {
        this.socketManager.send({method: 'stop_game', params: {gameID: this.gameID}});
    }

    endRound() {
        this.socketManager.send({method: 'end_round', params: {gameID: this.gameID}});
    }

    confirm() {
        this.socketManager.send({method: 'confirm_game', params: {gameID: this.gameID}});
    }

    incrementBlue() {
        this.socketManager.send({method: 'increment_blue', params: {gameID: this.gameID}});
    }

    incrementMagenta() {
        this.socketManager.send({method: 'increment_magenta', params: {gameID: this.gameID}});
    }

    incrementScore(basketColor) {
        if (basketColor === 'blue') {
            this.incrementBlue();
        } else if (basketColor === 'magenta') {
            this.incrementMagenta();
        }
    }

    incrementFoulsLeft() {
        this.socketManager.send({method: 'increment_fouls_left', params: {gameID: this.gameID}});
    }

    incrementFoulsRight() {
        this.socketManager.send({method: 'increment_fouls_right', params: {gameID: this.gameID}});
    }

    incrementFouls(sideIndex) {
        if (sideIndex === 0) {
            this.incrementFoulsLeft();
        } else if (sideIndex === 1) {
            this.incrementFoulsRight();
        }
    }

    setScoreValidity(sideIndex, scoreIndex, isValid) {
        this.socketManager.send({
            method: 'set_score_validity',
            params: {sideIndex, scoreIndex, isValid, gameID: this.gameID}
        });
    }

    setFoulValidity(sideIndex, foulIndex, isValid) {
        this.socketManager.send({
            method: 'set_foul_validity',
            params: {sideIndex, foulIndex, isValid, gameID: this.gameID}
        });
    }

    setReady(sideIndex, isReady) {
        this.socketManager.send({
            method: 'set_ready',
            params: {sideIndex, isReady}
        });
    }
}