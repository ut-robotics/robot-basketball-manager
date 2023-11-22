import serverApi from "../js/server-api.js";

const boxElement = document.getElementById('box');
const containerElement = document.getElementById('container');

const ballPlacement = await serverApi.getRandomBalls();

function render(ballPlacement) {
    console.log(ballPlacement);

    boxElement.innerHTML = ballPlacement
            .map(point => `<div class="dot" style="left: ${point[0] * 100 + 225}px;top: ${-point[1] * 100 + 150}px"></div>`)
            .join('');
}

render(ballPlacement);