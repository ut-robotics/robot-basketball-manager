import {css, html, LitElement} from "../lib/lit.mjs";
import getValidScoreCounts from "./util/get-valid-score-counts.js";
import './runtime-counter.js';
import './running-time.js';

class MainRound extends LitElement {
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
            
            .scores {
                display: flex;
            }
            
            .scores > div {
                margin-right: 10px;
                width: 200px;
                color: white;
            }
            
            .score {
                padding: 5px;
            }
            
            .side {
                margin-top: 5px;
            }
            
            .magenta-basket {
                background-color: #d600d6;
            }
            
            .blue-basket {
                background-color: dodgerblue;
            }
        `;
    }

    constructor() {
        super();
        this.state = {};
        this.durationStartTime = Date.now();
    }

    isRunning() {
        const {runs} = this.state;
        const lastRun = runs[runs.length - 1];

        return !!(lastRun && !lastRun.endTime);
    }

    handleStart() {
        this.serverWebsocketApi.start();
    }

    handleStop() {
        this.serverWebsocketApi.stop();
    }

    handleEnd() {
        this.serverWebsocketApi.endRound();
    }

    handleConfirm() {
        this.serverWebsocketApi.confirm();
    }

    handleAddScore(sideIndex) {
        this.serverWebsocketApi.incrementScore(this.state.baskets[sideIndex]);
    }

    handleAddFoul(sideIndex) {
        this.serverWebsocketApi.incrementFouls(sideIndex);
    }

    handleScoreIsValidChange(sideIndex, scoreIndex, event) {
        console.log('handleScoreIsValidChange', event.target.checked);
        this.serverWebsocketApi.setScoreValidity(sideIndex, scoreIndex, event.target.checked);
    }

    render() {
        const {scores, baskets} = this.state;

        if (!scores) {
            return null;
        }

        const leftClass = 'side ' + (baskets[0] === 'blue' ? 'blue-basket' : 'magenta-basket');
        const rightClass = 'side ' + (baskets[1] === 'blue' ? 'blue-basket' : 'magenta-basket');

        return html`${this.renderHeader()}
            <div class="scores">
            <div class="${leftClass}">${this.renderSide(0)}</div>
            <div class="${rightClass}">${this.renderSide(1)}</div>
            </div>`;
    }

    renderHeader() {
        const {roundIndex, scores, fouls, runs} = this.state;
        const scoreCounts = getValidScoreCounts(scores);
        const foulsLeft = fouls[0].length;
        const foulsRight = fouls[1].length;
        const foulsText = (foulsLeft > 0 || foulsRight > 0) ? ` | Fouls: [${foulsLeft} - ${foulsRight}]` : '';

        return html`<header>
            <span>Round ${roundIndex + 1} | Scores: [${scoreCounts[0]} - ${scoreCounts[1]}]${foulsText}</span>
            <span>${this.renderControls()}</span>
            <span>${this.renderRuntime()}</span>
            <span>${this.renderDuration()}</span>
            </header>`;
    }

    renderControls() {
        return html`${this.renderStartStopButton()}${this.renderEndButton()}${this.renderConfirmButton()}`;
    }

    renderStartStopButton() {
        const {hasEnded, isConfirmed} = this.state;
        const isRunning = this.isRunning();

        if (hasEnded || isConfirmed) {
            return null;
        }

        if (isRunning) {
            return html`<button @click=${this.handleStop}>Stop</button>`;
        } else {
            return html`<button @click=${this.handleStart}>Start</button>`;
        }
    }

    renderEndButton() {
        if (this.state.hasEnded || this.state.runs.length === 0) {
            return null;
        }

        return html`<button @click=${this.handleEnd}>End</button>`;
    }

    renderConfirmButton() {
        const {hasEnded, isConfirmed} = this.state;

        if (!hasEnded || isConfirmed) {
            return null;
        }

        return html`<button @click=${this.handleConfirm}>Confirm</button>`;
    }

    renderRuntime() {
        if (this.state.isConfirmed) {
            return null;
        }

        const {runs, timeLimit} = this.state;
        let elapsed = 0;
        let running = false;
        let lastStartTime = Date.now();

        for (const run of runs) {
            if (!run.endTime) {
                running = true;
            } else {
                elapsed += run.endTime - run.startTime;
            }

            lastStartTime = run.startTime;
        }

        return html`<runtime-counter ?running=${running} .elapsed=${elapsed} .laststarttime=${lastStartTime} .timelimit=${timeLimit}></runtime-counter>`;
    }

    renderDuration() {
        if (this.state.isConfirmed) {
            return null;
        }

        const {runs} = this.state;

        if (runs.length > 0) {
            if (this.state.hasEnded) {
                const lastRun = runs[runs.length - 1];

                this.durationStartTime = lastRun.endTime;
            } else {
                this.durationStartTime = runs[0].startTime;
            }
        }

        return html`<running-time .running=${true} .startTime=${this.durationStartTime}></running-time>`
    }

    renderSide(sideIndex) {
        // language=HTML
        return html`<div>${this.renderSideControls(sideIndex)}</div>
            ${this.renderScores(sideIndex)}`;
    }

    renderSideControls(sideIndex) {
        const {hasEnded, isConfirmed} = this.state;

        if (isConfirmed) {
            return null;
        }

        return html`${this.renderAddScoreButton(sideIndex)}${this.renderAddFoulButton(sideIndex)}`;
    }

    renderAddScoreButton(sideIndex) {
        return html`<button @click=${this.handleAddScore.bind(this, sideIndex)}>Add score</button>`;
    }

    renderAddFoulButton(sideIndex) {
        return html`<button @click=${this.handleAddFoul.bind(this, sideIndex)}>Add foul</button>`;
    }

    renderScores(sideIndex) {
        const scores = this.state.scores[sideIndex];

        return scores.map((score, scoreIndex) => this.renderScore(score, sideIndex, scoreIndex));
    }

    renderScore(score, sideIndex, scoreIndex) {
        const {runs, isConfirmed} = this.state;
        const runtimeSeconds = getRuntimeMillis(runs, score.time) / 1000;

        return html`<div class="score">
            <span>${runtimeSeconds.toFixed(1)}</span>
            <label><input 
                type="checkbox" 
                ?disabled=${isConfirmed} 
                ?checked=${score.isValid} 
                @change=${this.handleScoreIsValidChange.bind(this, sideIndex, scoreIndex)}
                /> Valid</label>
            </div>`;
    }
}

customElements.define('main-round', MainRound);

function getRuntimeMillis(runs, time) {
    let runTime = 0;
    let lastEndTime = 0;

    for (const run of runs) {
        if (!run.endTime) {
            if (run.startTime <= time) {
                return time - run.startTime + runTime;
            }
        }

        if (run.startTime <= time && time <= run.endTime) {
            return time - run.startTime + runTime;
        }

        if (time < run.startTime) {
            return runTime;
        }

        runTime += run.endTime - run.startTime;

        lastEndTime = run.endTime;
    }

    if (lastEndTime) {
        return runTime;
    }

    return 0;
}