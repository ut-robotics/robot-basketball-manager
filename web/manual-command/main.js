import {html, LitElement, classMap} from "../lib/lit-element.mjs";
import AudioPlayer from "../js/audio-player.js";


class ManualCommander extends LitElement {
    static get properties() {
        return {
            robots: {type: Array},
            isTimerEnabled: {type: Boolean},
            timerValue: {type: Number},
            timerInputValue: {type: String},
            isTimerInputValid: {type: Boolean},
        };
    }

    constructor() {
        super();

        this.robots = [{id: 'robot1', basket: 'blue'}, {id: 'robot2', basket: 'magenta'}];

        this.audioPlayer = new AudioPlayer();

        this.isTimerEnabled = false;
        this.timerStartValue = 30;
        this.timerValue = this.timerStartValue;
        this.timerInputValue = this.timerStartValue.toString();
        this.isTimerInputValid = true;

        this.startTime = null;
        this.timerEndTime = null;

        this.timerAnimationFrameRequest = null;
    }

    createRenderRoot() {
        return this;
    }

    sendStart(targets, baskets) {
        return fetch(`/manual-command/start/${targets}/${baskets}`);
    }

    sendStop(targets) {
        return fetch(`/manual-command/stop/${targets}`);
    }

    startTimer() {
        this.stopTimer();

        this.startTime = Date.now();
        this.timerEndTime = this.startTime + this.timerStartValue * 1000;

        this.updateTime();
    }

    stopTimer() {
        cancelAnimationFrame(this.timerAnimationFrameRequest);
    }

    updateTime() {
        this.timerValue = (this.timerEndTime - Date.now()) / 1000;

        if (this.timerValue <= 0) {
            this.timerValue = 0;

            this.handleStop();

            return;
        }

        this.timerAnimationFrameRequest = requestAnimationFrame(() => {
            this.updateTime()
        });
    }

    handleStart() {
        const targets = this.robots.map(t => t.id);
        const baskets = this.robots.map(t => t.basket);

        this.sendStart(targets, baskets);

        this.audioPlayer.whistleShort();

        if (this.isTimerEnabled) {
            this.startTimer();
        }
    }

    handleStop() {
        const targets = this.robots.map(t => t.id);

        this.sendStop(targets);

        this.audioPlayer.whistleLong();

        this.stopTimer();
    }

    handleRobotKeyup(event) {
        const index = event.target.dataset.index;
        const robot = this.robots[index];

        robot.id = event.target.value;
    }

    handleBasketClick(event) {
        const index = event.target.dataset.index;
        const robot = this.robots[index];

        robot.basket = robot.basket === 'blue' ? 'magenta' : 'blue';

        this.robots = this.robots.slice();
    }

    handleTimerEnable(event) {
        this.isTimerEnabled = event.target.checked;
    }

    handleTimerStartChange(event) {
        const inputValue = event.target.value;

        const parsedValue = parseInt(inputValue, 10);

        if (parsedValue > 0 && parsedValue.toString() === inputValue) {
            this.timerStartValue = parsedValue;
            this.isTimerInputValid = true;
        } else {
            this.isTimerInputValid = false;
        }

        this.timerInputValue = inputValue;
    }

    render() {
        return html`<div>
            ${this.renderTimer()}
            <button class="signal-button" @click=${this.handleStart}>Start</button>
            <button class="signal-button" @click=${this.handleStop}>Stop</button>
            ${this.robots.map((robot, index) => this.renderRobot(robot, index))}          
            </div>`;
    }

    renderTimer() {
        const inputClassMap = classMap({
            'timer-input': true,
            error: !this.isTimerInputValid,
        });

        return html`<div class="timer-controls">
            <input type="checkbox" ?checked=${this.isTimerEnabled} @change=${this.handleTimerEnable}>
            <input type="text" class=${inputClassMap} .value=${this.timerInputValue} @keyup=${this.handleTimerStartChange}>
            <span>${this.timerValue.toFixed(1)}</span>
            </div>`;
    }

    renderRobot(robot, index) {
        const classes = ['basket', robot.basket];

        return html`<div class="robot">
            <input data-index=${index} @keyup=${this.handleRobotKeyup} type="text" .value=${robot.id}>
            <button data-index=${index} @click=${this.handleBasketClick} class=${classes.join(' ')}></button>
            </div>`;
    }
}

customElements.define('manual-commander', ManualCommander);