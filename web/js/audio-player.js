export default class AudioPlayer {
    constructor() {
        this.whistleShortTrack = new Audio('/audio/whistle_blow_short.mp3');
        this.whistleLongTrack = new Audio('/audio/whistle_blow_long.mp3');
        this.buzzerTrack = new Audio('/audio/basketball_buzzer.mp3');
    }

    async whistleShort() {
        this.whistleShortTrack.currentTime = 0;

        try {
            await this.whistleShortTrack.play();
        } catch (e) {
            console.log(e);
        }
    }

    async whistleLong() {
        this.whistleLongTrack.currentTime = 0;

        try {
            await this.whistleLongTrack.play();
        } catch (e) {
            console.log(e);
        }
    }

    async buzzer() {
        this.buzzerTrack.currentTime = 0;

        try {
            await this.buzzerTrack.play();
        } catch (e) {
            console.log(e);
        }
    }

    stopAll() {
        this.whistleShortTrack.pause();
        this.whistleLongTrack.pause();
        this.buzzerTrack.pause();
    }
}