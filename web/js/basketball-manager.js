import {css, html, LitElement} from "../lib/lit-element.mjs";
import './basketball-game.js';
import WebsocketManager from "./util/websocket-manager.js";
import {stringify} from '../lib/json-stringify-compact.js';
import serverApi from "./server-api.js";

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
        serverApi.onMessage(this.onSocketMessage.bind(this));
        this._activeGameState = {};
    }

    createRenderRoot() {
        return this;
    }

    onSocketMessage(message) {
        try {
            const info = JSON.parse(message);

            switch (info.event) {
                case 'game_state':
                    this.activeGameState = info.params;
                    break;
            }
        } catch (error) {
            console.info(error);
        }
    }

    handleCreateGame(event) {
        event.preventDefault();

        const formData = new FormData(event.target);
        const robotIDs = [
            formData.get('robot1'),
            formData.get('robot2'),
        ];

        serverApi.createGame(robotIDs);
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