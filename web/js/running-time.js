import {css, html, LitElement} from "../lib/lit.mjs";
import {Duration} from "../lib/luxon.mjs";

class RunningTime extends LitElement {
    static get properties() {
        return {
            running: {type: Boolean},
            startTime: {type: Number},
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
        this.startTime = Date.now();

        this.updateTimeout = null;
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
        return Date.now() - this.startTime;
    }

    startTimer() {
        this.stopTimer();

        this.updateTime();
    }

    stopTimer() {
        clearTimeout(this.updateTimeout);
    }

    updateTime() {
        this.updateTimeout = setTimeout(() => {
            this.requestUpdate();
            this.updateTime();
        }, 500);
    }

    render() {
        const runtime = this.calcRuntime();
        const duration = Duration.fromMillis(runtime);

        return html`${duration.toFormat('mm:ss')}`;
    }
}

customElements.define('running-time', RunningTime);