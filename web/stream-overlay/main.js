import '../components/game-info-box/game-info-box.js';
import {LitElement} from "../competition-results/lib/lit.mjs";
import WebsocketManager from "../js/util/websocket-manager.js";
import {html} from "../lib/lit.mjs";
import serverApi from "../js/server-api.js";

class StreamOverlay extends LitElement {
    static get properties() {
        return {
            competitionInfo: {type: Object},
            activeGameState: {type: Object},
        };
    }

    constructor() {
        super();

        this.socketManager = new WebsocketManager(this.onSocketMessage.bind(this));

        this.fetchCompetitionInfo();
    }

    createRenderRoot() {
        return this;
    }

    onSocketMessage(message) {
        try {
            const info = JSON.parse(message);

            switch (info.event) {
                case 'competition_summary':
                    this.competitionInfo = info.params;
                    break;
                case 'game_state':
                    console.log(info.params);
                    this.activeGameState = info.params;
                    break;
            }
        } catch (error) {
            console.info(error);
        }
    }

    async fetchCompetitionInfo() {
        try {
            this.competitionInfo = await serverApi.getCompetition();
        } catch (apiError) {
            if (apiError.status === 404) {
                this.competitionInfo = {};
            }
        }
    }

    render() {
        const breakEnabled = this.competitionInfo.breakInfo.isEnabled;

        if (breakEnabled) {
            return this.renderBreak();
        }

        if (!this.competitionInfo.activeGame) {
            return null;
        }

        return html`<game-info-box .activeGameState=${this.activeGameState}></game-info-box>`;
    }

    renderBreak() {
        const isEnabled = this.competitionInfo.breakInfo.isEnabled;

        if (!isEnabled) {
            return null;
        }

        return html`<div class="break-info">
            <div class="break-text">Break</div>
            ${this.renderBreakCounter()}
        </div>`;
    }

    renderBreakCounter() {
        const endTime = this.competitionInfo.breakInfo.endTime;
        const nowTime = Date.now();

        if (endTime <= nowTime) {
            return null;
        }

        const elapsed = 0;
        const lastStartTime = nowTime;
        const timeLimit = endTime - nowTime;

        return html`<game-info-box-counter 
                ?running=${true} 
                .elapsed=${elapsed}
                .laststarttime=${lastStartTime}
                .timelimit=${timeLimit}
                ?showminutes=${true}
        ></game-info-box-counter>`;
    }
}

customElements.define('stream-overlay', StreamOverlay);