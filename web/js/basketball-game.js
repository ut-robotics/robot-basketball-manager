import {css, html, LitElement} from "../lib/lit-element.mjs";
import './main-round.js';
import './free-throws.js';

class BasketballGame extends LitElement {
    static get properties() {
        return {
            state: {type: Object}
        };
    }

    static get styles() {
        // language=CSS
        return css`
            :host {
                display: block;
            }
            
            header {
                padding: 5px 10px;
                border-bottom: 1px solid lightgray;
            }
            
            :host main-round {
                padding: 5px 10px;
            }
        `;
    }

    constructor() {
        super();
        this.state = {};
    }

    render() {
        if (!this.state || !this.state.rounds) {
            return null;
        }

        const {robots} = this.state;

        return html`<header>${robots[0].name} vs ${robots[1].name}${this.renderWinner()}</header>
            ${this.renderRounds(this.state.rounds)}
            ${this.renderFreeThrows()}`;
    }

    renderWinner() {
        const {status} = this.state;

        if (status.result === 'unknown') {
            return null;
        }

        if (status.result === 'won') {
            return html` | <b>${status.winner.name} WON</b>`;
        }

        return html` | <b>TIE</b>`;
    }

    renderRounds(rounds) {
        return html`${rounds.map(this.renderRound)}`;
    }

    renderRound(round, index) {
        return html`<main-round state=${JSON.stringify({roundIndex: index, ...round})}>`;
    }

    renderFreeThrows() {
        const {freeThrows} = this.state;

        if (!freeThrows) {
            return null;
        }

        return html`<free-throws state=${JSON.stringify(freeThrows)}></free-throws>`
    }
}

customElements.define('basketball-game', BasketballGame);