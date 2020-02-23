import {css, html, LitElement} from "../lib/lit-element.mjs";
import './basketball-game.js';
import WebsocketManager from "./util/websocket-manager.js";
import {stringify} from '../lib/json-stringify-compact.js';
import serverApi from "./server-api.js";

class BasketballManager extends LitElement {
    static get properties() {
        return {
            activeGameState: {type: Object}
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

    render() {
        return html`<basketball-game state=${JSON.stringify(this.activeGameState)}></basketball-game>
            <div class="raw-state">${stringify(this.activeGameState, {maxLength: 120})}</div>`;
    }
}

customElements.define('basketball-manager', BasketballManager);