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
const wrapperElement = document.getElementById('wrapper');
const freeThrowRobotElement = document.getElementById('freethrow-robot');

// const testImageElement = document.getElementById('test-image');
const videoElement = document.getElementById('court-video');

let activeGameState = null;

let scaleX = 1;
let scaleY = 1;

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
        wrapperElement.classList.remove('active');
    } else if (type === 'roundStopped' || type === 'freeThrowAttemptEnded' || type === 'roundEnded') {
        wrapperElement.classList.add('active');
    }
}

function coordinateMetersToPercent(value, scale) {
    return value / scale * 50 + 50;
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
        const roundCount = lastRound?.length || 0;
        const robotIndex = roundCount % 2;
        const robot = robots[robotIndex];
        const basket = baskets[robotIndex];

        // 1.3 meters from basket:
        // Backboard from center = 2.25 + 0.05
        // Basket diameter 0.16
        const freeThrowBallOffsetFromCenter = 2.25 + 0.05 - 0.16 - 1.3; // 1.3 meters from basket

        const freeThrowBallX = (basket === leftBasket ? -freeThrowBallOffsetFromCenter : freeThrowBallOffsetFromCenter);
        const freeThrowBallY = 0;

        const robotNameX = (basket === leftBasket ? -0.2 : 0.2);

        freeThrowRobotElement.innerText = robot.name;
        freeThrowRobotElement.classList.add('active');

        boxElement.innerHTML = `<div class="dot" style="left: ${coordinateMetersToPercent(freeThrowBallX, 2.25)}%;top: ${coordinateMetersToPercent(freeThrowBallY, 1.5)}%"></div>`
            + `<div class="robot-position" style="left: ${coordinateMetersToPercent(0, 2.25)}%;top: ${coordinateMetersToPercent(0, 1.5)}%"></div>`;
    } else {
        freeThrowRobotElement.innerText = '';
        freeThrowRobotElement.classList.remove('active');

        console.log(ballPlacement);

        const lastRound = rounds[rounds.length - 1];
        const baskets = lastRound.baskets;

        const leftRobot = robots[1 - baskets.indexOf(leftBasket)];
        const rightRobot = robots[1 - baskets.indexOf(rightBasket)];

        boxElement.innerHTML = `<div class="left-robot">${leftRobot.name}</div>`
            + `<div class="right-robot">${rightRobot.name}</div>`
            + ballPlacement
                .map(point => `<div class="dot" style="left: ${(point[0] / 2.25 * 50) + 50}%;top: ${(-point[1] / 1.5 * 50) + 50}%"></div>`)
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

function scaleXY(element, scaleX, scaleY) {
    element.style.transform = `scaleX(${scaleX}) scaleY(${scaleY})`;
}

let currentDraggedCorner = -1;
let currentSelectedCorner = -1;
let corners =  [100, 100, 550, 100, 100, 400, 550, 400];

try {
    const savedCorners = JSON.parse(localStorage.getItem('corners-with-camera'));

    if (Array.isArray(savedCorners) && savedCorners.length === 8) {
        corners = savedCorners;
    }
} catch (error) {
    console.error(error);
}

function update() {
    // transform2d(boxElement, ...corners);
    // transform2d(testImageElement, ...corners);
    transform2d(videoElement, ...corners);

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

    if (event.code === 'Space') {
        event.preventDefault();
        wrapperElement.classList.toggle('active');
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
    } else {
        switch (event.code) {
            case 'KeyX':
                scaleX = -scaleX;
                scaleXY(containerElement, scaleX, scaleY)
                break;
            case 'KeyY':
                scaleY = -scaleY;
                scaleXY(containerElement, scaleX, scaleY)
                break;
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
    localStorage.setItem('corners-with-camera', JSON.stringify(corners));
}

window.addEventListener('mouseup', () => {
    currentDraggedCorner = -1;
    saveCorners();
});

window.addEventListener('mousemove', handleMouseMove);

document.addEventListener('keydown', handleKeyDown);

document.addEventListener('keyup', handleKeyUp);

const cameraConstraints = {
    video: {width: {exact: 1920}, height: {exact: 1080}},
    audio: false,
};

navigator.mediaDevices
    .getUserMedia(cameraConstraints)
    .then((localMediaStream) => {
        const video = document.querySelector('video');
        video.srcObject = localMediaStream;
    })
    .catch((error) => {
        console.log('Rejected!', error);
    });

/*
if (!navigator.mediaDevices?.enumerateDevices) {
    console.log("enumerateDevices() not supported.");
} else {
    // List cameras and microphones.
    navigator.mediaDevices
        .enumerateDevices()
        .then((devices) => {
            console.log(devices);

            let videoSource = null;

            devices.forEach((device) => {
                if (device.kind === 'videoinput') {
                    videoSource = device.deviceId;
                }
            });

            sourceSelected(videoSource);
        })
        .catch((err) => {
            console.error(`${err.name}: ${err.message}`);
        });
}
*/

async function getBestCamera(criteriaFunc) {
    return navigator.mediaDevices.getUserMedia({audio: false, video: true}).then(() => {
        return navigator.mediaDevices.enumerateDevices().then((devices) => {
            const sortedDevices = devices
                .filter(device => device.kind == 'videoinput')
                .toSorted((device1, device2) => {
                    const capabilities1 = device1.getCapabilities();
                    const capabilities2 = device2.getCapabilities();

                    console.log(device1, device2)
                    console.log("capabilities1", capabilities1)
                    console.log("capabilities2", capabilities2)

                    return criteriaFunc(capabilities1, capabilities2); // return type: truthy
                })
            console.log("sortedDevices: ", sortedDevices)
            return sortedDevices;
        })
            .then(sortedDevices => sortedDevices[0])
    })
}

// Usage:

// return type: truthy
function compareResolutions(capabilities1, capabilities2) {
    return (capabilities1.height.max * capabilities1.width.max) > (capabilities2.height.max * capabilities2.width.max)
}

getBestCamera(compareResolutions).then(bestCamera => {
    console.log("bestCamera: ", bestCamera)
    console.log("capabilities: ", bestCamera.getCapabilities())

    //sourceSelected(bestCamera.deviceId);
}); // just to log stuff returned

function sourceSelected(videoSource) {
    if (!videoSource) {
        console.error('No videoSource');
        return;
    }

    const constraints = {
        audio: false,
        video: {width: {exact: 1920}, height: {exact: 1080}},
        //video: {deviceId: videoSource},
    };
    navigator.mediaDevices.getUserMedia(constraints)
        .then((localMediaStream) => {
            const video = document.querySelector('video');
            video.srcObject = localMediaStream;
        })
        .catch((error) => {
            console.log('Rejected!', error);
        });
}

//sourceSelected(true);

update();