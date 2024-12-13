import {html, LitElement} from "../../competition-results/lib/lit.mjs";
import {css} from "../../lib/lit.mjs";

class GameInfoBoxCounter extends LitElement {
    static get properties() {
        return {
            running: {type: Boolean},
            elapsed: {type: Number},
            laststarttime: {type: Number},
            timelimit: {type: Number},
        };
    }

    static get styles() {
        // language=CSS
        return css`
            :host {
                display: inline-block;
            }`;
    }

    constructor() {
        super();
        this.running = false;
        this.elapsed = 0;
        this.laststarttime = Date.now();
        this.timelimit = 0;

        this.timerAnimationFrameRequest = null;
    }

    disconnectedCallback() {
        super.disconnectedCallback();

        this.stopTimer();
    }

    willUpdate(changedProperties) {
        if (changedProperties.has('running')) {
            if (this.running) {
                this.startTimer();
            } else {
                this.stopTimer();
            }
        }
    }

    calcRuntime() {
        return this.elapsed + (this.running ? Date.now() - this.laststarttime : 0);
    }

    startTimer() {
        this.stopTimer();

        this.updateTime();
    }

    stopTimer() {
        cancelAnimationFrame(this.timerAnimationFrameRequest);
    }

    updateTime() {
        this.timerAnimationFrameRequest = requestAnimationFrame(() => {
            this.requestUpdate();
            this.updateTime();
        });
    }

    render() {
        const runtime = this.calcRuntime();
        const timeLimit = this.timelimit;
        //const upCount = (Math.min(runtime, timeLimit) / 1000).toFixed(1);
        let downCount = (Math.max(0, timeLimit - runtime) / 1000).toFixed(1);

        downCount = downCount.length > 3 ? downCount.slice(0, -2) : downCount;

        return html`<span>${downCount}</span>`;
    }
}

customElements.define('game-info-box-counter', GameInfoBoxCounter);