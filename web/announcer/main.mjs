import {html, LitElement} from "../lib/lit.mjs";
import {stringify} from '../lib/json-stringify-compact.js';
import ServerWebsocketApi from "../js/server-websocket-api.js";
import getValidScoreOrFoulCounts from "../js/util/get-valid-score-counts.js";

class AnnouncerView extends LitElement {
    static get properties() {
        return {
            gameInfo: {type: Object},
            isAnnouncerEnabled: {type: Boolean},
            voices: {type: Array},
            activeVoice: {type: Object},
        };
    }

    constructor() {
        super();

        this.serverWebsocketApi = new ServerWebsocketApi(this.gameID);
        this.serverWebsocketApi.onMessage(this.onSocketMessage.bind(this));

        this.isAnnouncerEnabled = true;

        this.voices = speechSynthesis.getVoices();
        this.activeVoice = null;

        if (this.voices.length === 0) {
            speechSynthesis.addEventListener('voiceschanged', () => {
                this.voices = speechSynthesis.getVoices();
                console.log('voiceschanged', this.voices);

                if (!this.activeVoice) {
                    this.activeVoice = this.voices.find(v => v.voiceURI === 'Google UK English Female');
                }
            });
        }

        this.testText = null;
    }

    createRenderRoot() {
        return this;
    }

    announce(text) {
        if (this.isAnnouncerEnabled) {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.voice = this.activeVoice;
            console.log(this.activeVoice);
            speechSynthesis.speak(utterance);
        }
    }

    onSocketMessage(message) {
        try {
            const info = JSON.parse(message);

            console.log(info);

            switch (info.event) {
                case 'game_state':
                    this.gameInfo = info.params;
                    break;
                case 'game_state_change':
                    this.handleGameStateChange(info.params);
                    break;
                case 'game_set_active':
                    const robot1 = info.params.robots[0].name;
                    const robot2 = info.params.robots[1].name;
                    this.announce(`New game. ${robot1} versus ${robot2}`);
                    break;
            }
        } catch (error) {
            console.info(error);
        }
    }

    handleGameStateChange(params) {
        const type = params.type;

        console.log(Date.now(), 'handleGameStateChange', type);

        if (type === 'roundAdded') {
            const roundNumber = this.gameInfo.rounds.length;
            this.announce(`Round ${roundNumber}`);
        } else if (type === 'freeThrowsAdded') {
            this.announce(`Free throws`);
        } else if (type === 'scoreChanged' || type === 'roundScoreValidityChanged') {
            const lastRound = this.gameInfo.rounds[this.gameInfo.rounds.length - 1];
            const scoreCounts = getValidScoreOrFoulCounts(lastRound.scores);

            this.announce(`${scoreCounts[0]} ${scoreCounts[1]}`);
        } else if (type === 'foulsChanged' || type === 'roundFoulValidityChanged') {
            const sideIndex = params.sideIndex;
            const lastRound = this.gameInfo.rounds[this.gameInfo.rounds.length - 1];
            const foulCounts = getValidScoreOrFoulCounts(lastRound.fouls);
            const foulCount = foulCounts[sideIndex];
            const robotName = this.gameInfo.robots[sideIndex].name;

            let announcerText = `foul for ${robotName}`;

            if (foulCount === 1) {
                announcerText = 'First ' + announcerText;
            } else if (foulCount === 2) {
                announcerText = 'Second ' + announcerText;
            } if (foulCount === 0) {
                announcerText = `No fouls for ${robotName}`;
            }

            this.announce(announcerText);
        } else if (type === 'ended') {
            const {result, winner} = this.gameInfo.status;

            if (result === 'tied') {
                this.announce('Tie');
            } else if (result === 'won') {
                this.announce(`${winner.name} won`);
            }
        } else if (type === 'readyChanged') {
            const sideIndex = params.sideIndex;
            const lastRound = this.gameInfo.rounds[this.gameInfo.rounds.length - 1];
            const isReady = lastRound.readyStates[sideIndex];
            const robotName = this.gameInfo.robots[sideIndex].name;

            this.announce(`${robotName} ${isReady ? 'Ready' : 'Not ready'}`);
        }
    }

    handleEnableChanged(event) {
        this.isAnnouncerEnabled = event.target.checked;
    }

    handleVoiceChanged(event) {
        console.log(this.voices[event.target.value] === this.activeVoice);
        this.activeVoice = this.voices[event.target.value];
        console.log(this.activeVoice);
    }

    handleTestTextChanged(event) {
        this.testText = event.target.value;
    }

    handleTestButtonPressed() {
        this.announce(this.testText);
    }

    render() {
        return html`${this.renderEnable()}
            ${this.renderVoices()}
            ${this.renderTestInputs()}
            ${this.renderRawState()}`;
    }

    renderEnable() {
        return html`<div><label><input type="checkbox" .checked=${this.isAnnouncerEnabled} @change=${this.handleEnableChanged}>Enable</label></div>`
    }

    renderVoices() {
        return html`<select @change=${this.handleVoiceChanged}>
            ${this.voices.map((v, i) => 
                    html`<option value=${i} ?selected=${v === this.activeVoice}>${v.name} (${v.lang})</option>`
            )}
        </select>`;
    }

    renderTestInputs() {
        return html`<div>
            <div><button @click=${this.handleTestButtonPressed}>Test</button></div>
            <div><textarea @change=${this.handleTestTextChanged}></textarea></div>
        </div>`;
    }

    renderRawState() {
        if (!this.gameInfo) {
            return html`<div>No game state</div>`;
        }

        return html`<div class="raw-state">${stringify(this.gameInfo, {maxLength: 120})}</div>`;
    }
}

customElements.define('announcer-view', AnnouncerView);