import {html, LitElement, classMap} from "../lib/lit.mjs";
import AudioPlayer from "../js/audio-player.js";
import WebsocketManager from "../js/util/websocket-manager.js";

class ManualCommander extends LitElement {
    static get properties() {
        return {
            robots: {type: Array},
            isTimerEnabled: {type: Boolean},
            timerValue: {type: Number},
            timerInputValue: {type: String},
            isTimerInputValid: {type: Boolean},
            clients: {type: Array},
            sentMessagesByConnectionId: {type: Object},
        };
    }

    constructor() {
        super();

        this.manualCommandSocketManager = new WebsocketManager(
            this.onManualCommandSocketMessage.bind(this),
            this.onManualCommandSocketOpen.bind(this),
            8115
        );

        this.robots = [
            {id: 'robot1', basket: 'blue', isEnabled: true},
            {id: 'robot2', basket: 'magenta', isEnabled: false},
        ];

        this.clientBasketsByConnectionId = {};
        this.clientEnabledByConnectionId = {};

        this.audioPlayer = new AudioPlayer();

        this.isTimerEnabled = false;
        this.timerStartValue = 60;
        this.timerValue = this.timerStartValue;
        this.timerInputValue = this.timerStartValue.toString();
        this.isTimerInputValid = true;

        this.startTime = null;
        this.timerEndTime = null;

        this.timerAnimationFrameRequest = null;

        this.sentMessagesByConnectionId = {};
    }

    createRenderRoot() {
        return this;
    }

    onManualCommandSocketOpen() {
        this.manualCommandSocketManager.send({method: 'get_clients_info', params: {gameID: this.gameID}});
    }

    onManualCommandSocketMessage(message) {
        try {
            const info = JSON.parse(message);

            console.log(info);

            switch (info.event) {
                case 'clients':
                    const clients = info.params;

                    const newClientBaskets = {};
                    const newClientEnabled = {};

                    for (const client of clients) {
                        newClientEnabled[client.connectionId] = false;
                        newClientBaskets[client.connectionId] = 'blue';
                    }

                    for (const [id, basket] of Object.entries(this.clientBasketsByConnectionId)) {
                        if (newClientBaskets[id]) {
                            newClientBaskets[id] = basket;
                        }
                    }

                    for (const [id, isEnabled] of Object.entries(this.clientEnabledByConnectionId)) {
                        if (newClientEnabled[id] !== undefined) {
                            newClientEnabled[id] = isEnabled;
                        }
                    }

                    this.clientBasketsByConnectionId = newClientBaskets;
                    this.clientEnabledByConnectionId = newClientEnabled;
                    this.clients = clients;

                    break;
                case 'sentMessages':
                    const sentMessages = info.params;

                    const byConnectionId = {};

                    for (const sentMessage of sentMessages) {
                        const {connectionId, time, ackTime} = sentMessage;
                        const message = JSON.parse(sentMessage.message);

                        const messageInfo = {time, ackTime, message};

                        if (byConnectionId[connectionId]) {
                            byConnectionId[connectionId].push(messageInfo);
                        } else {
                            byConnectionId[connectionId] = [messageInfo];
                        }
                    }

                    this.sentMessagesByConnectionId = byConnectionId;

                    break;
            }
        } catch (error) {
            console.info(error);
        }
    }

    sendSignal(signal, targets = undefined, connectionIds = undefined, baskets = undefined) {
        this.manualCommandSocketManager.send({method: 'signal', signal, targets, connectionIds, baskets});
    }

    sendStart(targets, connectionIds, baskets) {
        this.sendSignal('start', targets, connectionIds, baskets);
    }

    sendStop(targets, connectionIds) {
        this.sendSignal('stop', targets, connectionIds);
    }

    sendPing(targets, connectionIds) {
        this.sendSignal('ping', targets, connectionIds);
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
        const {targets, connectionIds, baskets} = this.getSignalParameters();

        if (targets.length > 0) {
            this.sendStart(targets, connectionIds, baskets);

            this.audioPlayer.whistleShort();
        }

        if (this.isTimerEnabled) {
            this.startTimer();
        }
    }

    handleStop() {
        const {targets, connectionIds, baskets} = this.getSignalParameters();

        if (targets.length > 0 || connectionIds.length > 0) {
            this.sendStop(targets, connectionIds);

            this.audioPlayer.whistleLong();
        }

        this.stopTimer();
    }

    handlePing() {
        const {targets, connectionIds, baskets} = this.getSignalParameters();

        if (targets.length > 0 || connectionIds.length > 0) {
            this.sendPing(targets, connectionIds);
        }
    }

    getSignalParameters() {
        const targets = [];
        const connectionIds = [];
        const baskets = [];

        for (const robot of this.robots) {
            if (robot.isEnabled) {
                targets.push(robot.id);
                baskets.push(robot.basket);
            }
        }

        if (Array.isArray(this.clients) && this.clients.length > 0) {
            for (const client of this.clients) {
                if (this.clientEnabledByConnectionId[client.connectionId]) {
                    targets.push(client.robotId);
                    baskets.push(this.clientBasketsByConnectionId[client.connectionId]);
                }
            }
        }

        return {targets, connectionIds, baskets};
    }

    handleRobotKeyup(event) {
        const index = event.target.dataset.index;
        const robot = this.robots[index];

        robot.id = event.target.value;

        this.requestUpdate();
    }

    handleBasketClick(event) {
        const index = event.target.dataset.index;
        const robot = this.robots[index];

        robot.basket = robot.basket === 'blue' ? 'magenta' : 'blue';

        this.robots = this.robots.slice();
    }

    handleRobotEnable(event) {
        const index = event.target.dataset.index;
        const robot = this.robots[index];

        robot.isEnabled = event.target.checked;

        this.requestUpdate();
    }

    handleClientEnable(event) {
        const index = event.target.dataset.index;
        const client = this.clients[index];
        this.clientEnabledByConnectionId[client.connectionId] = event.target.checked;

        this.requestUpdate();
    }

    handleClientBasketClick(event) {
        const index = event.target.dataset.index;
        const client = this.clients[index];
        let basket = this.clientBasketsByConnectionId[client.connectionId];

        this.clientBasketsByConnectionId[client.connectionId] = basket === 'blue' ? 'magenta' : 'blue';

        this.requestUpdate();
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
            <button class="signal-button" @click=${this.handlePing}>Ping</button>
            <table>
                <thead><th></th><th>Robot ID</th><th>Basket</th><th>IP address</th><th>Port</th><th>Connection</th><th>Sent messages</th></thead>
                <tbody>
                ${this.robots.map((robot, index) => this.renderRobot(robot, index))}          
                ${this.renderClients()}
                </tbody>
            </table>
            </div>`;
    }

    renderTimer() {
        const inputClassMap = classMap({
            'timer-input': true,
            error: !this.isTimerInputValid,
        });

        return html`<div class="timer-controls">
            <span>Automatic stop timer</span>
            <input type="checkbox" .checked=${this.isTimerEnabled} @change=${this.handleTimerEnable}>
            <input type="text" class=${inputClassMap} .value=${this.timerInputValue} @keyup=${this.handleTimerStartChange}>
            <span>${this.timerValue.toFixed(1)}</span>
            </div>`;
    }

    renderSignalParameters() {
        const parameters = this.getSignalParameters();

        return html`<div class="json">${JSON.stringify(parameters)}</div>`;
    }

    renderRobot(robot, index) {
        const classes = ['basket', robot.basket];

        return html`<tr>
            <td><input type="checkbox" data-index=${index} .checked=${robot.isEnabled} @change=${this.handleRobotEnable}></td>
            <td><input data-index=${index} @keyup=${this.handleRobotKeyup} type="text" .value=${robot.id}></td>
            <td><button data-index=${index} @click=${this.handleBasketClick} class=${classes.join(' ')}></button></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            </tr>`;
    }

    renderClients() {
        if (!Array.isArray(this.clients)) {
            return null;
        }

        return html`${this.clients.map((c, i) => this.renderClient(c, i))}</tbody>`;
    }

    renderClient(clientInfo, index) {
        const buttonClasses = ['basket', this.clientBasketsByConnectionId[clientInfo.connectionId]];
        const isEnabled = this.clientEnabledByConnectionId[clientInfo.connectionId]

        return html`<tr>
            <td><input type="checkbox" data-index=${index} .checked=${isEnabled} @change=${this.handleClientEnable}></td>
            <td>${clientInfo.robotId}</td>
            <td><button data-index=${index} @click=${this.handleClientBasketClick} class=${buttonClasses.join(' ')}></button></td>
            <td>${clientInfo.remoteAddress}</td>
            <td>${clientInfo.remotePort}</td>            
            <td>${clientInfo.connectionId}</td>            
            <td>${this.renderSentMessages(clientInfo.connectionId)}</td>            
            </tr>`;
    }

    renderSentMessages(connectionId) {
        const sentMessages = this.sentMessagesByConnectionId[connectionId];

        if (!sentMessages || !Array.isArray(sentMessages) || sentMessages.length === 0) {
            return null;
        }

        return html`<span class="sent-messages">${sentMessages.map(m => this.renderSentMessage(m))}</span>`;
    }

    renderSentMessage(sentMessage) {
        const smClassMap = classMap({
            'sent-message': true,
            acked: !!sentMessage.ackTime,
        });

        return html`<span class=${smClassMap}>${sentMessage.message.messageId} ${sentMessage.message.signal}</span>`;
    }
}

customElements.define('manual-commander', ManualCommander);