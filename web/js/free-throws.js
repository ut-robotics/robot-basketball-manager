import {css, html, LitElement} from "../lib/lit.mjs";
import './runtime-counter.js'

class FreeThrows extends LitElement {
    static get properties() {
        return {
            state: {type: Object},
            serverWebsocketApi: {attribute: false},
        };
    }

    static get styles() {
        // language=CSS
        return css`
            :host {
                display: block;
            }
            
            :host * {
                box-sizing: border-box;
            }
            
            header {
                padding: 5px 10px;
                border-bottom: 1px solid lightgray;
            }
            
            .round {
                padding: 5px 10px;
            }
            
            .attempt {
                display: inline-block;
                width: 200px;
                padding: 5px;
                margin-right: 10px;
                background-color: #EEEEEE;
            }
        `;
    }

    constructor() {
        super();
        this.state = {};
    }

    getLastRound() {
        const {rounds} = this.state;

        if (rounds.length === 0) {
            return null;
        }

        return rounds[rounds.length - 1];
    }

    getLastAttempt() {
        const lastRound = this.getLastRound();

        if (!lastRound || lastRound.length === 0) {
            return null;
        }

        return lastRound[lastRound.length - 1]
    }

    getRoundNumber() {
        const {rounds} = this.state;

        if (rounds.length === 0) {
            return 1;
        }

        const lastRound = rounds[rounds.length - 1];
        const lastAttempt = lastRound[lastRound.length - 1];

        if (lastRound.length < 2 || !lastAttempt.isConfirmed) {
            return rounds.length;
        }

        return rounds.length + 1;
    }

    isRunning() {
        const lastAttempt = this.getLastAttempt();

        return !!(lastAttempt && !lastAttempt.endTime);
    }

    isConfirmed() {
        const lastAttempt = this.getLastAttempt();

        return !!(lastAttempt && lastAttempt.isConfirmed);
    }

    handleStart() {
        this.serverWebsocketApi.start();
    }

    handleEndWithScore() {
        this.serverWebsocketApi.incrementScore('blue');
    }

    handleEndWithFoul() {
        this.serverWebsocketApi.incrementFouls(0);
    }

    handleConfirm() {
        this.serverWebsocketApi.confirm();
    }

    render() {
        const {scores, baskets} = this.state;

        if (!scores) {
            return null;
        }

        return html`${this.renderHeader()}
            ${this.renderRounds()}`;
    }

    renderHeader() {
        const {scores, rounds} = this.state;

        return html`<header>
            <span>Free throws | Round ${this.getRoundNumber()} | Scores: [${scores[0]} - ${scores[1]}]</span>
            <span>${this.renderControls()}</span>
            <span>${this.renderRuntime()}</span>
            </header>`;
    }

    renderControls() {
        const lastAttempt = this.getLastAttempt();

        const startButton = html`<button @click=${this.handleStart}>Start</button>`;

        if (!lastAttempt) {
            return [startButton];
        }

        const buttons = [];

        const isRunning = !lastAttempt.endTime;

        if (isRunning) {
            buttons.push(html`<button @click=${this.handleEndWithScore}>End with score</button>`);
            buttons.push(html`<button @click=${this.handleEndWithFoul}>End with foul</button>`);
        } else {
            if (lastAttempt.isConfirmed && !this.state.hasEnded) {
                buttons.push(startButton);
            } else if (!lastAttempt.isConfirmed) {
                buttons.push(html`<button @click=${this.handleConfirm}>Confirm</button>`);
            }
        }

        return buttons;
    }

    renderRuntime() {
        const lastAttempt = this.getLastAttempt();

        if (!lastAttempt || lastAttempt.isConfirmed) {
            return null;
        }

        const running = !lastAttempt.endTime;
        let lastStartTime = lastAttempt.startTime;

        return html`<runtime-counter ?running=${running} laststarttime=${lastStartTime} timelimit=${this.state.timeLimit}></runtime-counter>`;
    }

    renderRounds() {
        return html`<div>${this.state.rounds.map(round => this.renderRound(round))}</div>`;
    }

    renderRound(round) {
        return html`<div class="round">${round.map(attempt => this.renderAttempt(attempt))}</div>`;
    }

    renderAttempt(attempt) {
        const duration = !!attempt.endTime ? ((attempt.endTime - attempt.startTime) / 1000).toFixed(1) : '';

        return html`<div class="attempt">${attempt.didScore ? duration : '-'}</div>`;
    }
}

customElements.define('free-throws', FreeThrows);