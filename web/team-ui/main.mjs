import {classMap, html, LitElement} from "../lib/lit.mjs";
import ServerWebsocketApi from "../js/server-websocket-api.js";

class TeamView extends LitElement {
    static get properties() {
        return {
            gameInfo: {type: Object},
        };
    }

    constructor() {
        super();
        const urlParams = new URLSearchParams(document.location.search);
        this.sideIndex = parseInt(urlParams.get('side'), 10);
        this.basket = urlParams.get('basket');

        this.serverWebsocketApi = new ServerWebsocketApi(this.gameID);
        this.serverWebsocketApi.onMessage(this.onSocketMessage.bind(this));
    }

    createRenderRoot() {
        return this;
    }

    getLastRound() {
        const rounds = this.gameInfo.rounds;
        return rounds[rounds.length - 1];
    }

    getRobotIndex() {
        if (this.sideIndex === 0 || this.sideIndex === 1) {
            return this.sideIndex;
        }

        const rounds = this.gameInfo.rounds;
        const lastRound = rounds[rounds.length - 1];

        if (!lastRound) {
            return -1;
        }

        if (this.basket === 'blue' || this.basket === 'magenta') {
            return lastRound.baskets[0] === this.basket ? 0 : 1;
        }

        return -1;
    }

    getBasketColor() {
        const lastRound = this.getLastRound();

        if (!lastRound) {
            return false;
        }

        const robotIndex = this.getRobotIndex();

        return lastRound.baskets[robotIndex];
    }

    isReady() {
        const lastRound = this.getLastRound();

        if (!lastRound) {
            return false;
        }

        const robotIndex = this.getRobotIndex();

        return lastRound.readyStates[robotIndex];
    }

    handleReadyChanged(event) {
        const isReady = event.target.checked;

        if (this.gameInfo.freeThrows) {
            return;
        }

        this.serverWebsocketApi.setReady(this.getRobotIndex(), isReady);
    }

    onSocketMessage(message) {
        try {
            const info = JSON.parse(message);

            switch (info.event) {
                case 'game_state':
                    this.gameInfo = info.params;
                    break;
            }
        } catch (error) {
            console.info(error);
        }
    }

    render() {
        if (!this.gameInfo) {
            return html`<div>Game not active</div>`;
        }

        const basketColor = this.getBasketColor();

        const nameClassMap = classMap({
            'robot-name': true,
            [basketColor]: true,
        });

        return html`<div class="container">
            <div class=${nameClassMap}>${this.gameInfo.robots[this.getRobotIndex()].name}</div>
            ${this.renderReady()}
            </div>`;
    }

    renderReady() {
        const isReady = this.isReady();

        const readyContainerClassMap = classMap({
            'ready-container': true,
            ready: this.isReady(),
        });

        return html`<div class=${readyContainerClassMap}>
            <label><input type="checkbox" .checked=${isReady} @change=${this.handleReadyChanged}> Ready</label>
            </div>`;
    }
}

customElements.define('team-view', TeamView);