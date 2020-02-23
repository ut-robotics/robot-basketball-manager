import serverApi from "./server-api.js";

const createGameButton = document.getElementById('create-game');

createGameButton.addEventListener('click', () =>{
    serverApi.createGame();
});