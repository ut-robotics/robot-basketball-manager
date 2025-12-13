import {css, html, LitElement} from "../lib/lit.mjs";
import './main-round.js';
import './free-throws.js';

class BasketballGame extends LitElement {
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
            
            :host th {
                text-align: left;
                font-size: 24px;
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

    handleSetActive() {
        this.serverWebsocketApi.setActive();
    }

    render() {
        if (!this.state || !this.state.rounds) {
            return null;
        }

        const {robots} = this.state;

        return html`<table><thead>
            <tr>
                <th></th>
                <th>${this.renderSetActiveButton()}</th>
                <th>${robots[0].name}</th>
                <th>${robots[1].name}</th>
                <th>${this.renderWinner()}</th>
            </tr>
            </thead>
            <tbody>
                ${this.renderFreeThrows()}
                ${this.renderRounds(this.state.rounds)}
            </tbody>            
            </table>`;
    }

    renderWinner() {
        const {status} = this.state;

        if (status.result === 'unknown') {
            return null;
        }

        if (status.result === 'won') {
            return html`<b>${status.winner.name} WON</b>`;
        }

        return html`<b>TIE</b>`;
    }

    renderSetActiveButton() {
        if (this.state.hasEnded) {
            return null;
        }

        return html`<button @click=${this.handleSetActive}>Set active</button>`;
    }

    renderRounds(rounds) {
        const reverseRounds = rounds.slice().reverse();
        return html`${reverseRounds.map((round, index) => this.renderRound(round, rounds.length - 1 - index))}`;
    }

    renderRound(round, index) {
        return html`<main-round 
                .serverWebsocketApi=${this.serverWebsocketApi} 
                state=${JSON.stringify({roundIndex: index, ...round})}
                .robots=${this.state.robots}
        ></main-round>`;
    }

    renderFreeThrows() {
        const {freeThrows} = this.state;

        if (!freeThrows) {
            return null;
        }

        return html`<free-throws 
                .serverWebsocketApi=${this.serverWebsocketApi} 
                state=${JSON.stringify(freeThrows)}
        ></free-throws>`
    }
}

customElements.define('basketball-game', BasketballGame);