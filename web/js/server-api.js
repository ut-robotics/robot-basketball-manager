import WebsocketManager from "./util/websocket-manager.js";

class ServerApi {
    constructor() {
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
        this.socketManager.send({method: 'create_game', params: {robotIDs}});
    }

    start() {
        this.socketManager.send({method: 'start_game'});
    }

    stop() {
        this.socketManager.send({method: 'stop_game'});
    }

    endRound() {
        this.socketManager.send({method: 'end_round'});
    }

    confirm() {
        this.socketManager.send({method: 'confirm_game'});
    }

    incrementBlue() {
        this.socketManager.send({method: 'increment_blue'});
    }

    incrementMagenta() {
        this.socketManager.send({method: 'increment_magenta'});
    }

    incrementScore(basketColor) {
        if (basketColor === 'blue') {
            this.incrementBlue();
        } else if (basketColor === 'magenta') {
            this.incrementMagenta();
        }
    }

    incrementFoulsLeft() {
        this.socketManager.send({method: 'increment_fouls_left'});
    }

    incrementFoulsRight() {
        this.socketManager.send({method: 'increment_fouls_right'});
    }

    incrementFouls(sideIndex) {
        if (sideIndex === 0) {
            this.incrementFoulsLeft();
        } else if (sideIndex === 1) {
            this.incrementFoulsRight();
        }
    }

    setScoreValidity(sideIndex, scoreIndex, isValid) {
        this.socketManager.send({method: 'set_score_validity', params: {sideIndex, scoreIndex, isValid}});
    }

    async getRobots() {
        return fetch('/api/robots').then(response => response.json());
    }
}

const serverApi = new ServerApi();
export default serverApi;