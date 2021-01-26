import {html, LitElement} from "../lib/lit-element.mjs";


class ManualCommander extends LitElement {
    static get properties() {
        return {
            robots: {type: Array}
        };
    }

    constructor() {
        super();

        this.robots = [{id: 'robot1', basket: 'blue'}, {id: 'robot2', basket: 'magenta'}];
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

    handleStart() {
        const targets = this.robots.map(t => t.id);
        const baskets = this.robots.map(t => t.basket);

        this.sendStart(targets, baskets);
    }

    handleStop() {
        const targets = this.robots.map(t => t.id);

        this.sendStop(targets);
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

    render() {
        return html`<div>
            <button class="signal-button" @click=${this.handleStart}>Start</button>
            <button class="signal-button" @click=${this.handleStop}>Stop</button>
            ${this.robots.map((robot, index) => this.renderRobot(robot, index))}          
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