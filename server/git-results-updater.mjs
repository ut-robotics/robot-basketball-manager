import {exec} from 'child_process';
import fsPromises from 'fs/promises';
import fs from 'fs';
import path from 'path';
import {log} from "./util.mjs";

export class GitResultsUpdater {
    #competitionDirectory;
    #gitRemote;
    #htmlSourcePath = '../competition-results/';
    #isInitialized = false;
    #updateTimeout;
    #updateDelay = 10000;

    constructor(competitionDirectory, gitRemote) {
        this.#competitionDirectory = competitionDirectory;
        this.#gitRemote = gitRemote;

        this.#checkIsInitialized();
    }

    async #checkIsInitialized() {
        try {
            const accessMode = fs.constants.R_OK | fs.constants.W_OK;
            await fsPromises.access(path.join(this.#competitionDirectory, '.git'), accessMode);
            await fsPromises.access(path.join(this.#competitionDirectory, 'index.html'), accessMode);
            this.#isInitialized = true;
            log('Git results repository already initialized');
        } catch (e) {
            console.log(e);
        }

    }

    isInitialized() {
        return this.#isInitialized;
    }

    async init() {
        await this.#copyHTML();
        await this.#initGitRepo();
        this.#isInitialized = true;
        log('Git results repository initialized');
    }

    async #copyHTML() {
        await fsPromises.cp(path.join(this.#htmlSourcePath, 'lib'), path.join(this.#competitionDirectory, 'lib'), {recursive: true});

        for (const fileName of ['index.html', 'main.css', 'main.mjs']) {
            await fsPromises.cp(path.join(this.#htmlSourcePath, fileName), path.join(this.#competitionDirectory, fileName));
        }
    }

    async #runCommands(commands, workingDirectory) {
        for (const command of commands) {
            await this.#runCommand(command, workingDirectory);
        }
    }

    async #runCommand(command, workingDirectory) {
        console.log(command);

        return new Promise((resolve, reject) => {
            exec(command, {cwd: workingDirectory}, (error, stdout, stderr) => {
                if (error) {
                    console.error(error);
                    reject(error);
                } else {
                    console.log('stdout:');
                    console.log(stdout);
                    console.log('stderr:');
                    console.log(stderr);
                    resolve();
                }
            });
        });
    }

    async #initGitRepo() {
        const commands = [
            'git init',
            `git remote add origin ${this.#gitRemote}`,
            'git add -A',
            'git commit -m "Add html and initial competition state"',
            'git push --set-upstream origin main'
        ];

        await this.#runCommands(commands, this.#competitionDirectory);
    }

    update() {
        log('Git results update requested');

        clearTimeout(this.#updateTimeout);

        this.#updateTimeout = setTimeout(() => {
            this.#doUpdate();
        }, this.#updateDelay);
    }

    async #doUpdate() {
        const commands = [
            'git add -A',
            'git commit -m "Update competition state"',
            'git push',
        ];

        try {
            await this.#runCommands(commands, this.#competitionDirectory);

            log('Git results update done');
        } catch (e) {
            console.error(e);
        }
    }
}