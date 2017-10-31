import { autoUpdater as electronUpdater } from 'electron-updater';
import { EventEmitter } from 'events';
import * as path from 'path';

export enum EUpdateState {
    ApplicationIsUpToDate,
    CheckingForUpdate,
    UpdateIsAvailable,
    UpdateIsDownloading,
    UpdateIsReadyToInstall
}

class AppUpdater extends EventEmitter {
    private state = EUpdateState.ApplicationIsUpToDate;
    private autoDownload: boolean;
    private allowUpdateCheck: boolean;
    private allowPrerelease: boolean;

    constructor() {
        super();

        this.allowUpdateCheck = (process.argv.indexOf("--no-update") == -1);
        this.allowPrerelease = (process.argv.indexOf('--prerelease') >= 0);

        electronUpdater.logger = null;
        if (process.env.NODE_ENV === "development") {
            electronUpdater.updateConfigPath = path.join(process.cwd(), 'app-update.yml');
        }
        electronUpdater.on('checking-for-update', (ev: Event, ...args: any[]) => {
            this.state = EUpdateState.CheckingForUpdate;
            if (!this.autoDownload) {
                this.emit('checking-for-update', ...args);
            }
        });
        electronUpdater.on('update-available', (ev: Event, ...args: any[]) => {
            this.state = EUpdateState.UpdateIsAvailable;
            if (!this.autoDownload) {
                this.emit('update-available', ...args);
            }
        });
        electronUpdater.on('update-not-available', (...args: any[]) => {
            this.state = EUpdateState.ApplicationIsUpToDate;
            this.emit('up-to-date', ...args);
        });
        electronUpdater.on('error', (ev: Event, err: Error, ...args: any[]) => {
            this.state = EUpdateState.ApplicationIsUpToDate;
            this.emit('failed', err, ...args);
        });
        electronUpdater.on('download-progress', (ev: Event, ...args: any[]) => {
            this.state = EUpdateState.UpdateIsDownloading;
        });
        electronUpdater.on('update-downloaded', (ev: Event, ...args: any[]) => {
            this.state = EUpdateState.UpdateIsReadyToInstall;
            this.emit('ready-to-install', ...args);
        });
    }

    private _checkForUpdate(autoDownload: boolean) {
        if (this.allowUpdateCheck) {
            if (electronUpdater) {
                this.autoDownload = autoDownload;
                electronUpdater.allowPrerelease = this.allowPrerelease;
                electronUpdater.autoDownload = this.autoDownload;
                electronUpdater.allowDowngrade = false;
                electronUpdater.checkForUpdates();
            }
        }
    }

    public checkForUpdate() {
        if (this.state === EUpdateState.ApplicationIsUpToDate) {
            this._checkForUpdate(false);
        }
    }

    public downloadUpdate() {
        if (this.state === EUpdateState.UpdateIsAvailable) {
            this._checkForUpdate(true);
        }
    }

    public quitAndInstall() {
        if (this.state == EUpdateState.UpdateIsReadyToInstall) {
            if (electronUpdater) {
                electronUpdater.quitAndInstall(true, true);
            }
        }
    }
}

export var appUpdater = new AppUpdater();
