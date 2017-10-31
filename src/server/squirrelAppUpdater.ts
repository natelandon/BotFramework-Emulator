import { autoUpdater } from "electron";
import * as os from "os";
import * as process from "process";
var pjson = require('../../package.json');
import * as logger from './log';

class AppUpdater {
    allowUpdateCheck: boolean;
    allowPrerelease: boolean;

    constructor() {
        this.allowUpdateCheck = (process.argv.indexOf("--no-update") == -1);
        this.allowPrerelease = (process.argv.indexOf('--prerelease') >= 0);

        autoUpdater.addListener("update-available", (event: any) => {
            logger.debug("A new version is available. Downloading it now. You will be notified when download completes.");
        });
        autoUpdater.addListener("update-downloaded" as any, (event: any, releaseNotes: string, releaseName: string, releaseDate: string, updateURL: string) => {
            logger.debug("Download complete.", logger.makeCommandLink("Restart", 'autoUpdater.quitAndInstall', "Quit and install the update"), "the application to update.");
        });
        autoUpdater.addListener("error", (error: any) => {
            logger.error(error.message, error);
        });
        autoUpdater.addListener("checking-for-update", (event: any) => {
            logger.debug("Checking for new version...");
        });
        autoUpdater.addListener("update-not-available", () => {
            logger.debug("Application is up to date.");
        });

        if (this.allowUpdateCheck) {
            if (this.allowPrerelease) {
                autoUpdater.setFeedURL(`https://emulator.botframework.com/update/channel/rc/${os.platform()}/${pjson.version}`);
            } else {
                autoUpdater.setFeedURL(`https://emulator.botframework.com/update/${os.platform()}/${pjson.version}`);
            }
        }
    }

    public checkForUpdate() {
        try {
            if (this.allowUpdateCheck) {
                autoUpdater.checkForUpdates();
            }
        } catch(e) { }
    }
}

export var appUpdater = new AppUpdater();
