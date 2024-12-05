import WebsocketManager from '../js/util/websocket-manager.js';

let socketManager = new WebsocketManager(onSocketMessage);

const markerElements = [
    document.getElementById('marker0'),
    document.getElementById('marker1'),
    document.getElementById('marker2'),
    document.getElementById('marker3'),
];

const boxElement = document.getElementById('box');
const containerElement = document.getElementById('container');

let activeGameState = null;

function onSocketMessage(message) {
    try {
        const info = JSON.parse(message);

        switch (info.event) {
            case 'game_state':
                activeGameState = info.params;
                renderState(info.params);
                break;
            case 'game_state_change':
                handleGameStateChange(info.params.type);
                break;
        }
    } catch (error) {
        console.info(error);
    }
}

function handleGameStateChange(type) {
    console.log('handleGameStateChange', type);

    if (type === 'roundStarted' || type === 'freeThrowAttemptStarted') {
        containerElement.classList.remove('active');
    } else if (type === 'roundStopped' || type === 'freeThrowAttemptEnded' || type === 'roundEnded') {
        containerElement.classList.add('active');
    }
}

function renderState(state) {
    if (!state) {
        return;
    }

    const leftBasket = 'blue';
    const rightBasket = 'magenta';

    const {ballPlacement, robots, rounds, freeThrows} = state;

    if (freeThrows) {
        const {baskets, robots, rounds} = freeThrows;
        const lastRound = rounds[rounds.length - 1];
        const roundCount = lastRound.length;
        const robotIndex = roundCount % 2;
        const robot = robots[robotIndex];
        const basket = baskets[robotIndex];

        const freeThrowBallOffset = 1.3 + 0.16 - 0.05; // 1.3 meters from basket
        const freeThrowBallX = (basket === leftBasket ? freeThrowBallOffset : 4.5 - freeThrowBallOffset) * 100;
        const freeThrowBallY = 150;

        const robotNameX = 225 + (basket === leftBasket ? -20 : 20);
        const robotNameTransform = basket === leftBasket
            ? `rotate(-90deg) translate(50%, -100%)`
            : `rotate(90deg) translate(-50%, 0%)`;
        const robotNameStyle = `left: ${robotNameX}px;top: 150px;transform: ${robotNameTransform};`

        boxElement.innerHTML = `<div class="dot" style="left: ${freeThrowBallX}px;top: ${freeThrowBallY}px"></div>`
            + `<div class="freethrow-robot" style="${robotNameStyle}">${robot.name}</div>`
            + `<div class="robot-position" style="left: 225px; top: 150px"></div>`;
    } else {
        console.log(ballPlacement);

        const lastRound = rounds[rounds.length - 1];
        const baskets = lastRound.baskets;

        const leftRobot = robots[1 - baskets.indexOf(leftBasket)];
        const rightRobot = robots[1 - baskets.indexOf(rightBasket)];

        boxElement.innerHTML = `<div class="left-robot">${leftRobot.name}</div>`
            + `<div class="right-robot">${rightRobot.name}</div>`
            + ballPlacement
                .map(point => `<div class="dot" style="left: ${point[0] * 100 + 225}px;top: ${-point[1] * 100 + 150}px"></div>`)
                .join('');
    }
}

function adj(m) { // Compute the adjugate of m
    return [
        m[4] * m[8] - m[5] * m[7], m[2] * m[7] - m[1] * m[8], m[1] * m[5] - m[2] * m[4],
        m[5] * m[6] - m[3] * m[8], m[0] * m[8] - m[2] * m[6], m[2] * m[3] - m[0] * m[5],
        m[3] * m[7] - m[4] * m[6], m[1] * m[6] - m[0] * m[7], m[0] * m[4] - m[1] * m[3]
    ];
}

function multmm(a, b) { // multiply two matrices
    const c = Array(9);

    for (let i = 0; i !== 3; ++i) {
        for (let j = 0; j !== 3; ++j) {
            let cij = 0;

            for (let k = 0; k !== 3; ++k) {
                cij += a[3 * i + k] * b[3 * k + j];
            }

            c[3 * i + j] = cij;
        }
    }

    return c;
}

function multmv(m, v) { // multiply matrix and vector
    return [
        m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
        m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
        m[6] * v[0] + m[7] * v[1] + m[8] * v[2]
    ];
}

function pdbg(m, v) {
    const r = multmv(m, v);

    return r + ' (' + r[0] / r[2] + ', ' + r[1] / r[2] + ')';
}

function basisToPoints(x1, y1, x2, y2, x3, y3, x4, y4) {
    const m = [
        x1, x2, x3,
        y1, y2, y3,
        1,  1,  1
    ];

    const v = multmv(adj(m), [x4, y4, 1]);

    return multmm(m, [
        v[0], 0, 0,
        0, v[1], 0,
        0, 0, v[2]
    ]);
}

function general2DProjection(
    x1s, y1s, x1d, y1d,
    x2s, y2s, x2d, y2d,
    x3s, y3s, x3d, y3d,
    x4s, y4s, x4d, y4d
) {
    const s = basisToPoints(x1s, y1s, x2s, y2s, x3s, y3s, x4s, y4s);
    const d = basisToPoints(x1d, y1d, x2d, y2d, x3d, y3d, x4d, y4d);

    return multmm(d, adj(s));
}

function project(m, x, y) {
    const v = multmv(m, [x, y, 1]);

    return [v[0] / v[2], v[1] / v[2]];
}

function transform2d(elt, x1, y1, x2, y2, x3, y3, x4, y4) {
    const w = elt.offsetWidth;
    const h = elt.offsetHeight;
    let t = general2DProjection(0, 0, x1, y1, w, 0, x2, y2, 0, h, x3, y3, w, h, x4, y4);

    for (let i = 0; i !== 9; ++i) {
        t[i] = t[i]/t[8];
    }

    t = [
        t[0], t[3], 0, t[6],
        t[1], t[4], 0, t[7],
        0   , 0   , 1, 0   ,
        t[2], t[5], 0, t[8]
    ];

    t = 'matrix3d(' + t.join(', ') + ')';
    elt.style.transform = t;
}

let currentDraggedCorner = -1;
let currentSelectedCorner = -1;
let corners =  [100, 100, 550, 100, 100, 400, 550, 400];

try {
    const savedCorners = JSON.parse(localStorage.getItem('corners-with-projector'));

    if (Array.isArray(savedCorners) && savedCorners.length === 8) {
        corners = savedCorners;
    }
} catch (error) {
    console.error(error);
}

function update() {
    transform2d(boxElement, ...corners);

    for (let i = 0; i !== 8; i += 2) {
        const element = markerElements[i / 2];
        element.style.left = (corners[i] - 20) + 'px';
        element.style.top = (corners[i + 1] - 20) + 'px';

        if (i === currentSelectedCorner) {
            element.classList.add('active');
        } else {
            element.classList.remove('active');
        }
    }
}

function handleMouseMove(event) {
    if (currentDraggedCorner < 0) {
        return;
    }

    move(event.movementX, event.movementY);
}

function move(x, y) {
    corners[currentSelectedCorner] += x;
    corners[currentSelectedCorner + 1] += y;

    update();
}

window.addEventListener('mousedown', (event) => {
    const x = event.pageX
    const y = event.pageY
    let dx;
    let dy;

    let best = 400; // 20px grab radius
    currentDraggedCorner = -1;

    for (let i = 0; i !== 8; i += 2) {
        dx = x - corners[i];
        dy = y - corners[i + 1];

        if (best > dx * dx + dy * dy) {
            best = dx * dx + dy * dy;
            currentDraggedCorner = i;
            setSelectedCorner(i);
        }
    }

    handleMouseMove(event);
});

function setSelectedCorner(cornerIndex) {
    currentSelectedCorner = cornerIndex;
}

function handleKeyDown(event) {
    console.log('keyDown', event.code);

    if (event.code ===  'Space') {
        event.preventDefault();
        containerElement.classList.toggle('active');
    } else if (event.code.startsWith('Digit')) {
        const digit = parseInt(event.code[5], 10);

        if (digit >= 1 && digit <= 4) {
            setSelectedCorner((digit - 1) * 2);
        }
    } else if (event.code.startsWith('Arrow')) {
        if (currentSelectedCorner >= 0 && currentSelectedCorner < 8) {
            const multiplier = event.ctrlKey ? 0.1 : (event.shiftKey ? 10 : 1);

            switch (event.code) {
                case 'ArrowUp':
                    move(0, -1 * multiplier);
                    break;
                case 'ArrowDown':
                    move(0, 1 * multiplier);
                    break;
                case 'ArrowLeft':
                    move(-1 * multiplier, 0);
                    break;
                case 'ArrowRight':
                    move(1 * multiplier, 0);
                    break;
            }
        }
    }

    update();
}

function handleKeyUp(event) {
    console.log('keyUp', event.code);
    saveCorners();
}

function saveCorners() {
    console.log('saveCorners');
    localStorage.setItem('corners-with-projector', JSON.stringify(corners));
}

window.addEventListener('mouseup', () => {
    currentDraggedCorner = -1;
    saveCorners();
});

window.addEventListener('mousemove', handleMouseMove);

document.addEventListener('keydown', handleKeyDown);

document.addEventListener('keyup', handleKeyUp);

update();