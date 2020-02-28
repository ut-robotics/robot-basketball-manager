import {css, html, LitElement} from "../lib/lit-element.mjs";

class RuntimeCounter extends LitElement {
    static get properties() {
        return {
            running: {type: Boolean},
            elapsed: {type: Number},
            laststarttime: {type: Number},
            timelimit: {type: Number}
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
    }

    calcRuntime() {        
        return this.elapsed + (this.running ? Date.now() - this.laststarttime : 0);
    }

    render() {
        if (this.running) {
            setTimeout(() => {
                this.performUpdate();
            }, 100);
        }

        const runtime = this.calcRuntime();
        const timeLimit = this.timelimit;
        const upCount = (Math.min(runtime, timeLimit) / 1000).toFixed(1);
        const downCount = (Math.max(0, timeLimit - runtime) / 1000).toFixed(1);

        return html`&uarr; ${upCount} <b>&darr; ${downCount}</b>`;
    }
}

customElements.define('runtime-counter', RuntimeCounter);