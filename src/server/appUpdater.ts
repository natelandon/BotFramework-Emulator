import { autoUpdater as electronUpdater } from 'electron-updater';
import { EventEmitter } from 'events';
import * as path from 'path';

interface ICheckForUpdateOptions {
    autoDownload?: boolean
}

export enum EUpdateState {
    ApplicationIsUpToDate,
    CheckingForUpdate,
    UpdateIsAvailable,
    UpdateIsDownloading,
    UpdateIsReadyToInstall
}

class AppUpdater extends EventEmitter {
    private state = EUpdateState.ApplicationIsUpToDate;
    public allowPrerelease: boolean = false;
    private options: ICheckForUpdateOptions;

    constructor() {
        super();
        electronUpdater.logger = null;
        if (process.env.NODE_ENV === "development") {
            electronUpdater.updateConfigPath = path.join(process.cwd(), 'app-update.yml');
        }
        electronUpdater.on('checking-for-update', (ev: Event, ...args: any[]) => {
            this.state = EUpdateState.CheckingForUpdate;
            if (!this.options.autoDownload) {
                this.emit('checking-for-update', ...args);
            }
        });
        electronUpdater.on('update-available', (ev: Event, ...args: any[]) => {
            this.state = EUpdateState.UpdateIsAvailable;
            if (!this.options.autoDownload) {
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

    private _checkForUpdate(options: ICheckForUpdateOptions) {
        if (electronUpdater) {
            this.options = options;
            electronUpdater.allowPrerelease = this.allowPrerelease;
            electronUpdater.autoDownload = this.options.autoDownload;
            electronUpdater.allowDowngrade = false;
            electronUpdater.checkForUpdates();
        }
    }

    checkForUpdate() {
        if (this.state === EUpdateState.ApplicationIsUpToDate) {
            const options = {
                autoDownload: false
            };
            this._checkForUpdate(options);
        }
    }

    downloadUpdate() {
        if (this.state === EUpdateState.UpdateIsAvailable) {
            const options = {
                autoDownload: true
            };
            this._checkForUpdate(options);
        }
    }

    quitAndInstall() {
        if (this.state == EUpdateState.UpdateIsReadyToInstall) {
            if (electronUpdater) {
                electronUpdater.quitAndInstall(true, true);
            }
        }
    }
}

export var appUpdater = new AppUpdater();

