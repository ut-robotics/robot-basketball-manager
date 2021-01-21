import {css, html, LitElement} from "../lib/lit-element.mjs";
import './basketball-game.js';
import {stringify} from '../lib/json-stringify-compact.js';
import serverApi from "./server-api.js";
import ServerWebsocketApi from "./server-websocket-api.js";
import AudioPlayer from "./audio-player.js";

class BasketballManager extends LitElement {
    static get properties() {
        return {
            activeGameState: {type: Object},
            allRobots: {type: Array}
        };
    }

    set activeGameState(newState) {
        let oldVal = this._activeGameState;
        this._activeGameState = newState;
        this.requestUpdate('activeGameState', oldVal);
    }

    get activeGameState() {
        return this._activeGameState;
    }

    constructor() {
        super();
        serverWebsocketApi.onMessage(this.onSocketMessage.bind(this));
        this._activeGameState = {};
        this.audioPlayer = new AudioPlayer();

        document.addEventListener('keydown', this.handleKeyDown.bind(this));
    }

    createRenderRoot() {
        return this;
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
        if (this.activeGameState.freeThrows) {
            const rounds = this.activeGameState.freeThrows.rounds;
            const lastRound = rounds[rounds.length - 1];

            if (!lastRound) {
                serverWebsocketApi.start();
                return;
            }

            const lastAttempt = lastRound[lastRound.length - 1];

            if (lastAttempt.isConfirmed) {
                serverWebsocketApi.start();
            }

            return;
        }

        const {hasEnded, isConfirmed} = this.activeGameState;
        const isRunning = this.isRunning();

        if (hasEnded || isConfirmed) {
            return;
        }

        if (isRunning) {
            serverWebsocketApi.stop();
        } else {
            serverWebsocketApi.start();
        }
    }

    isRunning() {
        if (this.activeGameState.freeThrows) {
            return false;
        }

        const {rounds} = this.activeGameState;
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

            switch (info.event) {
                case 'game_state':
                    this.activeGameState = info.params;
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

    handleCreateGame(event) {
        event.preventDefault();

        const formData = new FormData(event.target);
        const robotIDs = [
            formData.get('robot1'),
            formData.get('robot2'),
        ];

        serverWebsocketApi.createGame(robotIDs);
    }

    render() {
        return html`<div>${this.renderCreateGame()}</div>
            <basketball-game state=${JSON.stringify(this.activeGameState)}></basketball-game>
            <div class="raw-state">${stringify(this.activeGameState, {maxLength: 120})}</div>`;
    }

    renderCreateGame() {
        if (this.activeGameState?.status?.result === 'unknown') {
            return null;
        }

        if (!Array.isArray(this.allRobots) || this.allRobots.length === 0) {
            serverApi.getRobots().then(allRobots => {
                this.allRobots = allRobots;
            });

            return null;
        }

        const robots = this.allRobots;

        return html`<form @submit=${this.handleCreateGame}>
            ${this.renderRobotSelection('robot1', robots, robots[0])}
            ${this.renderRobotSelection('robot2', robots, robots[1] || robots[0])}
            <button type="submit">Create game</button>
            </form>`;
    }

    renderRobotSelection(name, robots, selectedRobot) {
        return html`<select name=${name}>
            ${robots.map(robot => html`<option ?selected=${robot === selectedRobot} value=${robot.id}>${robot.name}</option>`)}
            </select>`;
    }
}

customElements.define('basketball-manager', BasketballManager);