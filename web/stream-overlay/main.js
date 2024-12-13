import '../components/game-info-box/game-info-box.js';
import {LitElement} from "../competition-results/lib/lit.mjs";
import WebsocketManager from "../js/util/websocket-manager.js";
import {html} from "../lib/lit.mjs";

class StreamOverlay extends LitElement {
    static get properties() {
        return {
            activeGameState: {type: Object}
        };
    }

    constructor() {
        super();

        this.socketManager = new WebsocketManager(this.onSocketMessage.bind(this));
    }

    createRenderRoot() {
        return this;
    }

    onSocketMessage(message) {
        try {
            const info = JSON.parse(message);

            switch (info.event) {
                case 'game_state':
                    console.log(info.params);
                    this.activeGameState = info.params;
                    break;
            }
        } catch (error) {
            console.info(error);
        }
    }

    render() {
        return html`<game-info-box .activeGameState=${this.activeGameState}></game-info-box>`;
    }
}

customElements.define('stream-overlay', StreamOverlay);