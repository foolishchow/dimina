import fs from '@ohos.file.fs';
import cryptoFramework from '@ohos.security.cryptoFramework';
import { http } from '@kit.NetworkKit';
import { BusinessError, request } from '@kit.BasicServicesKit';
import { DMPApp } from '../DApp/DMPApp';
import { DMPFileManager } from './Util/DMPFileManager';
import { DMPUnzipManager } from './Util/DMPUnzipManager';
import { DMPContextUtils } from '../Utils/DMPContextUtils';
import { DMPLogger } from '../EventTrack/DMPLogger';
import { Tags } from '../EventTrack/Tags';

interface DMPRemoteUpdateManifest {
  appId: string;
  name: string;
  path: string;
  versionCode: number;
  versionName: string;
  packageUrl: string;
  sha256?: string;
}

interface DMPRemoteManifestPayload {
  data?: DMPRemoteManifestPayload;
  appId?: string;
  name?: string;
  path?: string;
  versionCode?: number | string;
  versionName?: string;
  packageUrl?: string;
  downloadUrl?: string;
  url?: string;
  sha256?: string;
}

export interface DMPMiniProgramVersionInfo {
  hostManaged?: boolean;
  appId: string;
  name: string;
  path: string;
  versionCode: number;
  versionName: string;
}

class DMPUpdateCancelledError extends Error {
  constructor() {
    super('update operation cancelled');
  }
}

export class DMPRemoteUpdateManager {
  private static instance: DMPRemoteUpdateManager;
  private fileManager: DMPFileManager = DMPFileManager.sharedInstance();
  private operationTails: Map<string, Promise<void>> = new Map();
  private operationGenerations: Map<string, number> = new Map();
  private uninstallingApps: Set<string> = new Set();

  public static sharedInstance(): DMPRemoteUpdateManager {
    if (!DMPRemoteUpdateManager.instance) {
      DMPRemoteUpdateManager.instance = new DMPRemoteUpdateManager();
    }
    return DMPRemoteUpdateManager.instance;
  }

  /**
   * Install the manifest package before runtime startup when no runnable local
   * package exists. Normal updates still use checkForUpdate after launch.
   */
  async installInitialPackageIfNeeded(app: DMPApp): Promise<boolean> {
    const appId = app.appConfig.appId;
    this.validateAppId(appId);
    const token = this.operationToken(appId);
    return this.withAppLock(appId, async (): Promise<boolean> => {
      this.ensureOperationActive(appId, token);
      if (this.isPackageReady(appId)) {
        return false;
      }

      const manifestUrl = app.appConfig.updateManifestUrl?.trim() ?? '';
      if (!manifestUrl) {
        throw new Error(`mini program ${appId} has no local package or updateManifestUrl`);
      }

      const manifest = await this.fetchManifest(manifestUrl);
      this.ensureOperationActive(appId, token);
      this.validateManifestAppId(manifest, appId);

      const zipPath = await this.downloadPackage(manifest);
      try {
        this.ensureOperationActive(appId, token);
        await this.installPackage(manifest, zipPath, true);
      } catch (error) {
        this.removeFileIfExists(zipPath);
        throw error as Error;
      }
      return true;
    });
  }

  async checkForUpdate(app: DMPApp, operationToken: number): Promise<void> {
    const appId = app.appConfig.appId;
    const manifestUrl = app.appConfig.updateManifestUrl?.trim() ?? '';
    if (!manifestUrl) {
      app.notifyUpdateManagerStatus('noupdate');
      return;
    }

    let updateAnnounced = false;
    try {
      this.validateAppId(appId);
      await this.withAppLock(appId, async (): Promise<void> => {
        this.ensureOperationActive(appId, operationToken);
        const manifest = await this.fetchManifest(manifestUrl);
        this.ensureOperationActive(appId, operationToken);
        this.validateManifestAppId(manifest, appId);

        const currentVersion = app.bundleManager.getBundleInfo().currentJsAppBundleConfig?.versionCode ?? 0;
        if (manifest.versionCode <= currentVersion) {
          this.deletePendingPackage(appId);
          app.notifyUpdateManagerStatus('noupdate');
          return;
        }

        updateAnnounced = true;
        app.notifyUpdateManagerStatus('updating');

        const pendingVersion = this.pendingVersionCode(appId);
        if (pendingVersion !== undefined && pendingVersion >= manifest.versionCode) {
          app.notifyUpdateManagerStatus('updateready');
          return;
        }

        const zipPath = await this.downloadPackage(manifest);
        try {
          this.ensureOperationActive(appId, operationToken);
          await this.installPackage(manifest, zipPath, false);
        } catch (error) {
          this.removeFileIfExists(zipPath);
          throw error as Error;
        }
        app.notifyUpdateManagerStatus('updateready');
      });
    } catch (e) {
      if (e instanceof DMPUpdateCancelledError) {
        return;
      }
      DMPLogger.e(Tags.LOAD_REMOTE_BUNDLE, `远程更新失败: ${e}`);
      app.notifyUpdateManagerStatus(updateAnnounced ? 'updatefail' : 'noupdate');
    }
  }

  async activatePendingUpdate(appId: string): Promise<boolean> {
    this.validateAppId(appId);
    const token = this.operationToken(appId);
    return this.withAppLock(appId, async (): Promise<boolean> => {
      this.ensureOperationActive(appId, token);
      const pendingVersion = this.pendingVersionCode(appId);
      if (pendingVersion === undefined) {
        return false;
      }
      const currentVersion = this.currentVersionCode(appId);
      if (pendingVersion <= currentVersion) {
        this.deletePendingPackage(appId);
        return false;
      }
      const pendingConfig = this.loadPendingConfig(appId);
      if (!pendingConfig) {
        this.deletePendingPackage(appId);
        return false;
      }
      this.writeConfigAtomically(
        this.fileManager.getJSAppConfigPath(appId),
        JSON.stringify(pendingConfig)
      );
      this.deletePendingPackage(appId);
      return true;
    });
  }

  public operationToken(appId: string): number {
    return this.operationGenerations.get(appId) ?? 0;
  }

  public isPackageOperationInProgress(appId: string): boolean {
    return this.uninstallingApps.has(appId);
  }

  public beginUninstall(appId: string): void {
    this.validateAppId(appId);
    if (this.uninstallingApps.has(appId)) {
      throw new Error(`mini program ${appId} is already being uninstalled`);
    }
    this.uninstallingApps.add(appId);
    this.operationGenerations.set(appId, this.operationToken(appId) + 1);
  }

  public endUninstall(appId: string): void {
    this.uninstallingApps.delete(appId);
  }

  public async uninstallPackage(appId: string, clearUserData: boolean): Promise<void> {
    this.validateAppId(appId);
    await this.withAppLock(appId, async (): Promise<void> => {
      this.removeInstalledPackage(appId, clearUserData);
      this.deletePendingPackage(appId);
      this.removeDirectoryIfExists(`${DMPContextUtils.getUIAbilityContext().cacheDir}/dimina-updates/${appId}`);
      this.removeDirectoryIfExists(`${DMPContextUtils.getUIAbilityContext().cacheDir}/dimina-file-system/${appId}`);
      if (clearUserData) {
        this.removeDirectoryIfExists(
          `${DMPContextUtils.getUIAbilityContext().filesDir}/dimina-file-system/${appId}`
        );
      }
    });
  }

  public getAppVersionInfo(appId: string): DMPMiniProgramVersionInfo | undefined {
    this.validateAppId(appId);
    try {
      if (!this.isPackageReady(appId)) { return undefined; }
      const config = JSON.parse(fs.readTextSync(this.fileManager.getJSAppConfigPath(appId))) as DMPMiniProgramVersionInfo;
      if (config.appId !== appId || !Number.isInteger(config.versionCode) || config.versionCode < 0) {
        return undefined;
      }
      config.name = typeof config.name === 'string' ? config.name : '';
      config.path = typeof config.path === 'string' ? config.path : '';
      config.versionName = typeof config.versionName === 'string' ? config.versionName : '';
      return config;
    } catch (_) {
      return undefined;
    }
  }

  public async installLocalPackage(appId: string, packagePath: string): Promise<DMPMiniProgramVersionInfo> {
    this.validateAppId(appId);
    return this.withAppLock(appId, async (): Promise<DMPMiniProgramVersionInfo> => {
      const root = this.fileManager.getJSAppDir(appId);
      const staging = `${root}/.local-${Date.now()}`;
      const backup = `${root}/.local-backup-${Date.now()}`;
      let target = '';
      let backedUp = false;
      let moved = false;
      let committed = false;
      try {
        fs.mkdirSync(staging, true);
        if (!await DMPUnzipManager.unzipFileAtPathAsync(packagePath, staging)) {
          throw new Error('failed to unzip local package');
        }
        this.validatePackage(staging);
        const config = JSON.parse(fs.readTextSync(`${staging}/config.json`)) as DMPMiniProgramVersionInfo;
        if (config.appId !== appId || !Number.isInteger(config.versionCode) || config.versionCode < 0) {
          throw new Error('invalid local package config');
        }
        config.name = typeof config.name === 'string' ? config.name : '';
        config.path = typeof config.path === 'string' ? config.path : '';
        config.versionName = typeof config.versionName === 'string' ? config.versionName : '';
        config.hostManaged = true;
        if (!this.fileManager.writeJsonToFile(`${staging}/config.json`, JSON.stringify(config))) {
          throw new Error('failed to write local package config');
        }
        target = this.fileManager.getJSAppVersionDir(appId, config.versionCode.toString());
        if (fs.accessSync(target)) {
          fs.renameSync(target, backup);
          backedUp = true;
        }
        fs.renameSync(staging, target);
        moved = true;
        this.writeConfigAtomically(this.fileManager.getJSAppConfigPath(appId), JSON.stringify(config));
        committed = true;
        this.deletePendingPackage(appId);
        return config;
      } catch (error) {
        if (!committed) {
          if (moved) { this.removeDirectoryIfExists(target); }
          if (backedUp) { fs.renameSync(backup, target); }
        }
        throw error as Error;
      } finally {
        this.removeDirectoryIfExists(staging);
        if (committed) { this.removeDirectoryIfExists(backup); }
      }
    });
  }

  private isPackageReady(appId: string): boolean {
    const config = this.fileManager.loadJSAppConfig(appId);
    if (!config) {
      return false;
    }
    const versionCode: number | undefined = config.getNumber('versionCode');
    if (versionCode === undefined) {
      return false;
    }
    const versionDir = this.fileManager.getJSAppVersionDir(appId, versionCode.toString());
    try {
      this.validatePackage(versionDir);
      return true;
    } catch (_) { return false; }
  }

  private validateManifestAppId(
    manifest: DMPRemoteUpdateManifest,
    expectedAppId: string
  ): void {
    if (manifest.appId !== expectedAppId) {
      throw new Error(`manifest appId ${manifest.appId} does not match ${expectedAppId}`);
    }
  }

  private async fetchManifest(manifestUrl: string): Promise<DMPRemoteUpdateManifest> {
    const httpRequest = http.createHttp();
    const response = await httpRequest.request(manifestUrl, {
      method: http.RequestMethod.GET,
      expectDataType: http.HttpDataType.STRING,
      usingCache: false
    });
    const statusCode = response.responseCode ?? 200;
    if (statusCode < 200 || statusCode >= 300) {
      throw new Error(`manifest request failed: HTTP ${statusCode}`);
    }

    const raw = response.result as string;
    const json = JSON.parse(raw) as DMPRemoteManifestPayload;
    const data = json.data ?? json;
    return this.parseManifest(data);
  }

  private parseManifest(data: DMPRemoteManifestPayload): DMPRemoteUpdateManifest {
    const packageUrl = data.packageUrl
      ?? data.downloadUrl
      ?? data.url
      ?? '';

    if (!data.appId) {
      throw new Error('manifest missing appId');
    }
    if (!data.path) {
      throw new Error('manifest missing path');
    }
    if (data.versionCode === undefined) {
      throw new Error('manifest missing versionCode');
    }
    if (!packageUrl) {
      throw new Error('manifest missing packageUrl');
    }

    return {
      appId: data.appId,
      name: data.name ?? '',
      path: data.path,
      versionCode: Number(data.versionCode),
      versionName: data.versionName ?? '',
      packageUrl,
      sha256: data.sha256,
    };
  }

  private async downloadPackage(manifest: DMPRemoteUpdateManifest): Promise<string> {
    const context = DMPContextUtils.getUIAbilityContext();
    const updateDir = `${context.cacheDir}/dimina-updates/${manifest.appId}`;
    if (!fs.accessSync(updateDir)) {
      fs.mkdirSync(updateDir, true);
    }

    const localPath = `${updateDir}/${manifest.versionCode}.zip`;
    if (fs.accessSync(localPath)) {
      fs.unlinkSync(localPath);
    }

    return new Promise<string>((resolve, reject) => {
      request.downloadFile(context, {
        url: manifest.packageUrl,
        filePath: localPath
      }).then((downloadTask) => {
        downloadTask.on('complete', () => {
          if (fs.accessSync(localPath)) {
            resolve(localPath);
          } else {
            reject(new Error('package download failed'));
          }
        });
      }).catch((err: BusinessError) => {
        reject(new Error(`package download failed: ${err.message}`));
      });
    });
  }

  private async installPackage(
    manifest: DMPRemoteUpdateManifest,
    zipPath: string,
    activateImmediately: boolean
  ): Promise<void> {
    const versionDir = this.fileManager.getJSAppVersionDir(manifest.appId, manifest.versionCode.toString());
    try {
      if (manifest.sha256) {
        await this.verifySha256(zipPath, manifest.sha256);
      }
      if (fs.accessSync(versionDir)) {
        fs.rmdirSync(versionDir);
      }
      fs.mkdirSync(versionDir, true);

      const unzipResult = await DMPUnzipManager.unzipFileAtPathAsync(zipPath, versionDir);
      if (!unzipResult) {
        throw new Error('failed to unzip package');
      }

      this.writeConfig(manifest, `${versionDir}/config.json`);
      this.validatePackage(versionDir);
      if (activateImmediately) {
        this.writeConfigAtomically(
          this.fileManager.getJSAppConfigPath(manifest.appId),
          JSON.stringify(this.manifestConfig(manifest))
        );
      } else {
        const pendingDir = this.pendingDir(manifest.appId);
        if (!fs.accessSync(pendingDir)) {
          fs.mkdirSync(pendingDir, true);
        }
        this.writeConfigAtomically(
          this.pendingConfigPath(manifest.appId),
          JSON.stringify(this.manifestConfig(manifest))
        );
      }
    } catch (e) {
      if (fs.accessSync(versionDir)) {
        fs.rmdirSync(versionDir);
      }
      throw new Error(String(e));
    } finally {
      if (fs.accessSync(zipPath)) {
        fs.unlinkSync(zipPath);
      }
    }
  }

  private writeConfig(manifest: DMPRemoteUpdateManifest, path: string): void {
    if (!this.fileManager.writeJsonToFile(path, JSON.stringify(this.manifestConfig(manifest)))) {
      throw new Error(`failed to write config: ${path}`);
    }
  }

  private manifestConfig(manifest: DMPRemoteUpdateManifest): DMPMiniProgramVersionInfo {
    return {
      appId: manifest.appId,
      name: manifest.name,
      path: manifest.path,
      versionCode: manifest.versionCode,
      versionName: manifest.versionName,
    };
  }

  private validatePackage(versionDir: string): void {
    const requiredFiles = [
      `${versionDir}/main/app-config.json`,
      `${versionDir}/main/logic.js`,
    ];
    const missingFile = requiredFiles.find((file: string): boolean => !fs.accessSync(file) || !fs.statSync(file).isFile());
    if (missingFile) {
      throw new Error(`package missing required file: ${missingFile.replace(versionDir + '/', '')}`);
    }
  }

  private pendingDir(appId: string): string {
    return `${this.fileManager.getJSAppDir(appId)}/.pending`;
  }

  private pendingConfigPath(appId: string): string {
    return `${this.pendingDir(appId)}/config.json`;
  }

  private loadPendingConfig(appId: string): DMPMiniProgramVersionInfo | undefined {
    const path = this.pendingConfigPath(appId);
    if (!fs.accessSync(path)) {
      return undefined;
    }
    try {
      const config = JSON.parse(fs.readTextSync(path)) as DMPMiniProgramVersionInfo;
      if (config.appId !== appId || !Number.isInteger(config.versionCode)) {
        throw new Error('invalid pending package config');
      }
      const versionDir = this.fileManager.getJSAppVersionDir(appId, config.versionCode.toString());
      this.validatePackage(versionDir);
      return config;
    } catch (error) {
      this.deletePendingPackage(appId);
      throw error as Error;
    }
  }

  private pendingVersionCode(appId: string): number | undefined {
    return this.loadPendingConfig(appId)?.versionCode;
  }

  private currentVersionCode(appId: string): number {
    return this.fileManager.loadJSAppConfig(appId)?.getNumber('versionCode') ?? 0;
  }

  private deletePendingPackage(appId: string): void {
    this.removeDirectoryIfExists(this.pendingDir(appId));
  }

  private removeInstalledPackage(appId: string, clearUserData: boolean): void {
    const appRoot = this.fileManager.getJSAppDir(appId);
    if (!fs.accessSync(appRoot)) {
      return;
    }
    if (clearUserData) {
      fs.rmdirSync(appRoot);
      return;
    }

    fs.listFileSync(appRoot).forEach((item: string): void => {
      if (item !== 'resource') {
        this.removePathIfExists(`${appRoot}/${item}`);
      }
    });
    const resourceRoot = `${appRoot}/resource`;
    if (fs.accessSync(resourceRoot)) {
      fs.listFileSync(resourceRoot).forEach((item: string): void => {
        if (item !== 'store') {
          this.removePathIfExists(`${resourceRoot}/${item}`);
        }
      });
    }
  }

  private writeConfigAtomically(path: string, json: string): void {
    const parent = path.substring(0, path.lastIndexOf('/'));
    if (!fs.accessSync(parent)) {
      fs.mkdirSync(parent, true);
    }
    const tempPath = `${path}.tmp-${Date.now()}`;
    const backupPath = `${path}.backup-${Date.now()}`;
    this.removeFileIfExists(tempPath);
    this.removeFileIfExists(backupPath);
    if (!this.fileManager.writeJsonToFile(tempPath, json)) {
      throw new Error(`failed to write config: ${path}`);
    }

    let backedUp = false;
    try {
      if (fs.accessSync(path)) {
        fs.moveFileSync(path, backupPath, 0);
        backedUp = true;
      }
      fs.moveFileSync(tempPath, path, 0);
      this.removeFileIfExists(backupPath);
    } catch (error) {
      this.removeFileIfExists(path);
      if (backedUp && fs.accessSync(backupPath)) {
        fs.moveFileSync(backupPath, path, 0);
      }
      this.removeFileIfExists(tempPath);
      throw error as Error;
    }
  }

  private async withAppLock<T>(appId: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.operationTails.get(appId) ?? Promise.resolve();
    let release: () => void = (): void => {};
    const gate = new Promise<void>((resolve): void => {
      release = resolve;
    });
    const current = previous.catch((): void => {}).then((): Promise<void> => gate);
    this.operationTails.set(appId, current);
    await previous.catch((): void => {});
    try {
      return await operation();
    } finally {
      release();
      if (this.operationTails.get(appId) === current) {
        this.operationTails.delete(appId);
      }
    }
  }

  private ensureOperationActive(appId: string, token: number): void {
    if (this.uninstallingApps.has(appId) || this.operationToken(appId) !== token) {
      throw new DMPUpdateCancelledError();
    }
  }

  private validateAppId(appId: string): void {
    const reserved = new Set<string>(['jssdk', 'mmkv', 'mmkv_backup']);
    if (!/^[A-Za-z0-9._-]+$/.test(appId) || appId === '.' || appId === '..' || reserved.has(appId)) {
      throw new Error('invalid appId');
    }
  }

  private removePathIfExists(path: string): void {
    if (!fs.accessSync(path)) {
      return;
    }
    if (fs.statSync(path).isDirectory()) {
      fs.rmdirSync(path);
    } else {
      fs.unlinkSync(path);
    }
  }

  private removeDirectoryIfExists(path: string): void {
    if (fs.accessSync(path)) {
      fs.rmdirSync(path);
    }
  }

  private removeFileIfExists(path: string): void {
    if (fs.accessSync(path)) {
      fs.unlinkSync(path);
    }
  }

  private async verifySha256(filePath: string, expectedSha256: string): Promise<void> {
    const stat = fs.statSync(filePath);
    const file = fs.openSync(filePath, fs.OpenMode.READ_ONLY);
    try {
      const buffer = new ArrayBuffer(stat.size);
      fs.readSync(file.fd, buffer);
      const md = cryptoFramework.createMd('SHA256');
      await md.update({ data: new Uint8Array(buffer) });
      const result = await md.digest();
      let actualSha256 = '';
      for (let i = 0; i < result.data.length; i++) {
        actualSha256 += result.data[i].toString(16).padStart(2, '0');
      }
      if (actualSha256.toLowerCase() !== expectedSha256.toLowerCase()) {
        throw new Error('package sha256 mismatch');
      }
    } finally {
      fs.closeSync(file);
    }
  }
}
