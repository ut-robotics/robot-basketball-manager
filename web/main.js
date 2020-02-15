import WebsocketManager from "./util/websocket-manager.js";
import {stringify} from './json-stringify-compact.js';

let socketManager = new WebsocketManager(onSocketMessage);

initUI();

function onSocketMessage(message) {
    try {
        const info = JSON.parse(message);

        switch (info.event) {
            case 'game_state':
                renderState(info.params);
                break;
        }
    } catch (error) {
        console.info(error);
    }
}

function renderState(state) {
    const elState = document.querySelector('#state');
    elState.innerText = stringify(state, {maxLength: 120});
}

function initUI() {
    const createGameButton = document.getElementById('create-game');
    const startGameButton = document.getElementById('start-game');
    const stopGameButton = document.getElementById('stop-game');
    const incrementBlueButton = document.getElementById('increment-blue');
    const incrementMagentaButton = document.getElementById('increment-magenta');
    const incrementFoulsLeftButton = document.getElementById('increment-fouls-left');
    const incrementFoulsRightButton = document.getElementById('increment-fouls-right');

    createGameButton.addEventListener('click', () =>{
        socketManager.send({method: 'create_game'});
    });

    startGameButton.addEventListener('click', () =>{
        socketManager.send({method: 'start_game'});
    });

    stopGameButton.addEventListener('click', () =>{
        socketManager.send({method: 'stop_game'});
    });

    incrementBlueButton.addEventListener('click', () =>{
        socketManager.send({method: 'increment_blue'});
    });

    incrementMagentaButton.addEventListener('click', () =>{
        socketManager.send({method: 'increment_magenta'});
    });

    incrementFoulsLeftButton.addEventListener('click', () =>{
        socketManager.send({method: 'increment_fouls_left'});
    });

    incrementFoulsRightButton.addEventListener('click', () =>{
        socketManager.send({method: 'increment_fouls_right'});
    });
}