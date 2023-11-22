class ApiError {
    constructor(status, statusText) {
        this.status = status;
        this.statusText = statusText;
    }
}

async function request(url, options) {
    return await fetch(url, options).then(async (response) => {
        const contentType = response.headers.get('Content-Type');

        if (contentType) {
            if (contentType.includes('json')) {
                if (response.ok) {
                    return response.json();
                }

                throw await response.json();
            } else if (contentType.includes('octet-stream')) {
                if (response.ok) {
                    return response.arrayBuffer();
                }

                throw response.status;
            }
        }

        if (response.ok) {
            return response.text();
        }

        throw new ApiError(response.status, response.statusText);
    }).catch((errorInfo) => {
        console.error(errorInfo);

        throw errorInfo;
    });
}

async function get(url) {
    return request(url, {
        credentials: 'include',
    });
}

async function post(url, params) {
    return request(url, {
        method: 'POST',
        credentials: 'include',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(params)
    });
}

class ServerApi {
    async getRobots() {
        return get('/api/robots');
    }

    async getCompetitions() {
        return get('/api/competitions');
    }

    async getCompetition() {
        return get('/api/competition');
    }

    async setCompetition(params) {
        return post('/api/competition', params);
    }

    async addRobot(params) {
        return post(`/api/robot`, params);
    }

    async startTournament(params) {
        return post(`/api/tournament`, params);
    }

    async getGame(id) {
        return get(`/api/game/${id}`);
    }

    async getRandomBalls() {
        return get(`/api/random-balls`);
    }
}

const serverApi = new ServerApi();
export default serverApi;