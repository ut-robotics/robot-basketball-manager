import {classMap, css, html, LitElement} from "../lib/lit.mjs";
import getValidScoreOrFoulCounts from "./util/get-valid-score-counts.js";
import './runtime-counter.js';
import './running-time.js';

class MainRound extends LitElement {
    static get properties() {
        return {
            state: {type: Object},
            serverWebsocketApi: {attribute: false},
            robots: {type: Array},
        };
    }

    static get styles() {
        // language=CSS
        return css`
            :host {
                display: table-row;
            }
            
            :host > td {
                vertical-align: top;
            }

            :host > td:first-child {
                font-size: 30px;
                padding: 0 10px;
                width: 30px;
            }

            :host > td:nth-child(2) {
                width: 150px;
            }
            
            table.side {
                border-collapse: collapse;
            }
            
            table.side td {
                color: white;
                width: 100px;
                vertical-align: top;
            }
            
            runtime-counter {
                font-size: 30px;
            }

            .round-control {
                margin-right: 20px;
                margin-bottom: 10px;
            }

            .total-score {
                font-size: 30px;
                padding: 0 5px;
            }
            
            .score {
                padding: 5px;
            }
            
            .magenta-basket {
                background-color: #d600d6;
            }
            
            .blue-basket {
                background-color: dodgerblue;
            }

            .robot-fouls {
                opacity: 0;
                color: black;
                height: 30px;
            }

            .robot-fouls.active {
                opacity: 1;
                border: 1px solid black;
            }

            .robot-fouls.first {
                background-color: yellow;
            }

            .robot-fouls.second {
                background-color: red;
            }
        `;
    }

    constructor() {
        super();
        this.state = {};
        this.robots = [];
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

    handleFoulIsValidChange(sideIndex, foulIndex, event) {
        console.log('handleFoulIsValidChange', event.target.checked);
        this.serverWebsocketApi.setFoulValidity(sideIndex, foulIndex, event.target.checked);
    }

    render() {
        const {scores, baskets} = this.state;

        if (!scores) {
            return null;
        }

        const {roundIndex, fouls} = this.state;
        const scoreCounts = getValidScoreOrFoulCounts(scores);
        const foulCounts = getValidScoreOrFoulCounts(fouls);

        return html`<td>${roundIndex + 1}</td>
            <td>
                <div>${this.renderControls()}</div>
                <div>
                    <span>${this.renderRuntime()}</span>
                    ${this.renderDuration()}</span>
                </div>
            </td>
            <td>${this.renderSide(0, baskets[0], scoreCounts[0], foulCounts[0])}</td>
            <td>${this.renderSide(1, baskets[1], scoreCounts[1], foulCounts[1])}</td>
            <td>${this.renderWinner()}</td>`;
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
            return html`<button class="round-control" @click=${this.handleStop}>Stop</button>`;
        } else {
            return html`<button class="round-control" @click=${this.handleStart}>Start</button>`;
        }
    }

    renderEndButton() {
        if (this.state.hasEnded || this.state.runs.length === 0) {
            return null;
        }

        return html`<button class="round-control" @click=${this.handleEnd}>End</button>`;
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

    renderSide(sideIndex, basket, totalScore, foulCount) {
        const foulClasses = {
            'robot-fouls': true,
            active: foulCount > 0,
            first: foulCount === 1,
            second: foulCount >= 2,
        };

        const classes = 'side ' + (basket === 'blue' ? 'blue-basket' : 'magenta-basket');

        // language=HTML
        return html`<table class=${classes}><tbody>
            <tr>
                <td><div class="total-score">${totalScore}</div></td>
                <td><div class=${classMap(foulClasses)}></div></td>
            </tr>
            ${this.renderSideControls(sideIndex)}
            <tr>
                <td>${this.renderScoresOrFouls(sideIndex, this.state.scores[sideIndex], this.handleScoreIsValidChange)}</td>
                <td>${this.renderScoresOrFouls(sideIndex, this.state.fouls[sideIndex], this.handleFoulIsValidChange)}</td>
            </tr>
            </tr></tbody></table>`;
    }

    renderSideControls(sideIndex) {
        if (this.state.isConfirmed) {
            return null;
        }

        return html`<tr>
                <td>${this.renderAddScoreButton(sideIndex)}</td>
                <td>${this.renderAddFoulButton(sideIndex)}</td>
            </tr>`;
    }

    renderAddScoreButton(sideIndex) {
        return html`<button @click=${this.handleAddScore.bind(this, sideIndex)}>Add score</button>`;
    }

    renderAddFoulButton(sideIndex) {
        return html`<button @click=${this.handleAddFoul.bind(this, sideIndex)}>Add foul</button>`;
    }

    renderScoresOrFouls(sideIndex, items, isValidChangeHandler) {
        return items.map((item, index) =>
            this.renderScoreOrFoul(item, sideIndex, index, isValidChangeHandler.bind(this, sideIndex, index)));
    }

    renderScoreOrFoul(item, sideIndex, index, isValidChangeHandler) {
        const {runs, isConfirmed} = this.state;
        const runtimeSeconds = getRuntimeMillis(runs, item.time) / 1000;

        return html`<div class="score">
            <span>${runtimeSeconds.toFixed(1)}</span>
            <input type="checkbox" 
                ?disabled=${isConfirmed} 
                ?checked=${item.isValid} 
                @change=${isValidChangeHandler}
                />
            </div>`;
    }

    renderWinner() {
        const {isConfirmed, winnerIndex} = this.state;

        if (!isConfirmed) {
            return null;
        }

        if (winnerIndex !== -1) {
            return html`<b>${this.robots[winnerIndex].name} WON</b>`;
        }

        return html`<b>TIE</b>`;
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