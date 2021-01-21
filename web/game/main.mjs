import {css, html, LitElement} from "../lib/lit-element.mjs";
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
    }

    createRenderRoot() {
        return this;
    }

    async fetchGameInfo() {
        const urlParams = new URLSearchParams(document.location.search);
        this.gameInfo = await serverApi.getGame(urlParams.get('id'));
    }

    handleKeyDown(event) {
        console.log(event.code);

        switch (event.code) {
            case 'Space':
                event.preventDefault();
                this.handleStartStop();
                break;
        }
    }

    handleStartStop() {
        if (this.gameInfo.freeThrows) {
            const rounds = this.gameInfo.freeThrows.rounds;
            const lastRound = rounds[rounds.length - 1];

            if (!lastRound) {
                this.serverWebsocketApi.start();
                return;
            }

            const lastAttempt = lastRound[lastRound.length - 1];

            if (lastAttempt.isConfirmed) {
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
            this.serverWebsocketApi.stop();
        } else {
            this.serverWebsocketApi.start();
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
        console.log('handleGameStateChange', type);

        if (type === 'roundStarted' || type === 'freeThrowAttemptStarted') {
            this.audioPlayer.whistleShort();
        } else if (type === 'roundStopped' || type === 'freeThrowAttemptEnded') {
            this.audioPlayer.whistleLong();
        } else if (type === 'roundEnded') {
            this.audioPlayer.stopAll();
            this.audioPlayer.buzzer();
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