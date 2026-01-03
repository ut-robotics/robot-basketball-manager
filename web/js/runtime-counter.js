import {css, html, LitElement} from "../lib/lit.mjs";

class RuntimeCounter extends LitElement {
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

        this.secondsRemaining = 0;

        this.timerAnimationFrameRequest = null;

        this.audioContext = new AudioContext();
    }

    disconnectedCallback() {
        super.disconnectedCallback();

        this.stopTimer();
    }

    willUpdate(changedProperties) {
        this.calcSecondsRemaining();

        if (changedProperties.has('running')) {
            if (this.running) {
                this.startTimer();
            } else {
                this.stopTimer();
            }
        }
    }

    playBeep(delay, pitch, duration) {
        console.log('playBeep', delay, pitch, duration);

        const startTime = this.audioContext.currentTime + delay;
        const endTime = startTime + duration;

        const envelope = this.audioContext.createGain();
        envelope.connect(this.audioContext.destination);
        envelope.gain.value = 0;
        envelope.gain.setTargetAtTime(0.5, startTime, 0.1);
        envelope.gain.setTargetAtTime(0, endTime, 0.2);

        const oscillator = this.audioContext.createOscillator();
        oscillator.connect(envelope);

        oscillator.type = 'sine';
        oscillator.detune.value = pitch * 100;

        oscillator.start(startTime);
        oscillator.stop(endTime + 1);
    }

    calcRuntime() {        
        return this.elapsed + (this.running ? Date.now() - this.laststarttime : 0);
    }

    calcSecondsRemaining() {
        const runtime = this.calcRuntime();
        const timeLimit = this.timelimit;
        const prevSecondsRemainingRounded = Math.floor(this.secondsRemaining);
        this.secondsRemaining = Math.max(0, timeLimit - runtime) / 1000;
        const secondsRemainingRounded = Math.floor(this.secondsRemaining);

        if (secondsRemainingRounded < 10 && secondsRemainingRounded < prevSecondsRemainingRounded) {
            if (secondsRemainingRounded === 9) {
                this.playBeep(0, 0 ,0.05);
                this.playBeep(0.3, 5 ,0.05);
            } else if (secondsRemainingRounded < 5) {
                this.playBeep(0, 0 ,0.05);
            }
        }
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
            this.calcSecondsRemaining();
            this.updateTime();
        });
    }

    render() {
        return html`<b>&darr; ${this.secondsRemaining.toFixed(1)}</b>`;
    }
}

customElements.define('runtime-counter', RuntimeCounter);