import {css, html, LitElement} from "../lib/lit.mjs";
import '../js/basketball-game.js';
import {stringify} from '../lib/json-stringify-compact.js';
import serverApi from "../js/server-api.js";
import AudioPlayer from "../js/audio-player.js";
import ServerWebsocketApi from "../js/server-websocket-api.js";

class GameView extends LitElement {
    static get properties() {
        return {
            gameInfo: {type: Object}
        };
    }

    constructor() {
        super();
        const urlParams = new URLSearchParams(document.location.search);
        this.gameID = parseInt(urlParams.get('id'), 10);

        this.serverWebsocketApi = new ServerWebsocketApi(this.gameID);
        this.serverWebsocketApi.onMessage(this.onSocketMessage.bind(this));

        this.audioPlayer = new AudioPlayer();

        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        document.addEventListener('keyup', this.handleKeyUp.bind(this));
    }

    createRenderRoot() {
        return this;
    }

    async fetchGameInfo() {
        const urlParams = new URLSearchParams(document.location.search);
        this.gameInfo = await serverApi.getGame(urlParams.get('id'));
    }

    handleKeyDown(event) {
        if (event.code === 'Space') {
            event.preventDefault();
        }
    }

    handleKeyUp(event) {
        console.log(Date.now(), event.code);

        if (event.code === 'Space') {
            event.preventDefault();

            const shouldStart = event.ctrlKey;
            this.handleStartStop(shouldStart);
        }
    }

    /**
     * @param {?boolean} shouldStart
     */
    handleStartStop(shouldStart) {
        if (this.gameInfo.freeThrows) {
            const rounds = this.gameInfo.freeThrows.rounds;
            const lastRound = rounds[rounds.length - 1];

            if (!lastRound) {
                if (shouldStart === true) {
                    this.serverWebsocketApi.start();
                }

                return;
            }

            const lastAttempt = lastRound[lastRound.length - 1];

            if (lastAttempt.isConfirmed && shouldStart === true) {
                this.serverWebsocketApi.start();
            }

            return;
        }

        const {hasEnded, isConfirmed} = this.gameInfo;
        const isRunning = this.isRunning();

        if (hasEnded || isConfirmed) {
            return;
        }

        if (isRunning) {
            if (shouldStart === false) {
                this.serverWebsocketApi.stop();
            }
        } else {
            if (shouldStart === true) {
                this.serverWebsocketApi.start();
            }
        }
    }

    isRunning() {
        if (this.gameInfo.freeThrows) {
            return false;
        }

        const {rounds} = this.gameInfo;
        const lastRound = rounds[rounds.length - 1];

        if (!lastRound) {
            return;
        }

        const {runs} = lastRound;
        const lastRun = runs[runs.length - 1];

        return !!(lastRun && !lastRun.endTime);
    }

    onSocketMessage(message) {
        try {
            const info = JSON.parse(message);

            if (info.params.id !== this.gameID) {
                return;
            }

            switch (info.event) {
                case 'game_state':
                    this.gameInfo = info.params;
                    break;
                case 'game_state_change':
                    this.handleGameStateChange(info.params.type);
                    break;
            }
        } catch (error) {
            console.info(error);
        }
    }

    handleGameStateChange(type) {
        console.log(Date.now(), 'handleGameStateChange', type);

        if (type === 'roundStarted' || type === 'freeThrowAttemptStarted') {
            this.audioPlayer.whistleShort();
        } else if (type === 'roundStopped' || type === 'freeThrowAttemptEnded') {
            this.audioPlayer.whistleLong();
        } else if (type === 'roundEnded') {
            const lastRound = this.gameInfo.rounds[this.gameInfo.rounds.length - 1];

            if (lastRound.duration >= lastRound.timeLimit) {
                // round ended with time running out
                this.audioPlayer.stopAll();
                this.audioPlayer.buzzer();
            }
        }
    }

    render() {
        if (!this.gameInfo) {
            this.fetchGameInfo();

            return html`<div>Loading...</div>`;
        }

        return html`<basketball-game .serverWebsocketApi=${this.serverWebsocketApi} state=${JSON.stringify(this.gameInfo)}></basketball-game>
            <div class="raw-state">${stringify(this.gameInfo, {maxLength: 120})}</div>`;
    }
}

customElements.define('game-view', GameView);