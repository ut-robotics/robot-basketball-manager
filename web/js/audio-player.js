export default class AudioPlayer {
    constructor() {
        this.whistleShortTrack = new Audio('/audio/whistle_blow_short.mp3');
        this.whistleLongTrack = new Audio('/audio/whistle_blow_long.mp3');
        this.buzzerTrack = new Audio('/audio/basketball_buzzer.mp3');

        this.audioContext = new AudioContext();
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

    playBeep(delay, pitch, duration, gain = 0.5) {
        const startTime = this.audioContext.currentTime + delay;
        const endTime = startTime + duration;

        const envelope = this.audioContext.createGain();
        envelope.connect(this.audioContext.destination);
        envelope.gain.value = 0;
        envelope.gain.setTargetAtTime(gain, startTime, 0.1);
        envelope.gain.setTargetAtTime(0, endTime, 0.2);

        const oscillator = this.audioContext.createOscillator();
        oscillator.connect(envelope);

        oscillator.type = 'sine';
        oscillator.detune.value = pitch * 100;

        oscillator.start(startTime);
        oscillator.stop(endTime + 1);
    }

    beepSimple() {
        this.playBeep(0, 0, 0.05);
    }

    beepDouble() {
        this.playBeep(0, 0 ,0.05);
        this.playBeep(0.3, 5 ,0.05);
    }

    beepAscending() {
        this.playBeep(0, 0 ,0.05);
        this.playBeep(0.2, 2 ,0.1);
    }

    beepDescending() {
        this.playBeep(0, -2 ,0.05);
        this.playBeep(0.2, -4 ,0.1);
    }
}