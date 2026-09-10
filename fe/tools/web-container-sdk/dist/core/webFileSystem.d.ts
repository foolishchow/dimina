export declare const VIRTUAL_FILE_PREFIX = "difile://";
export declare const VIRTUAL_USER_PREFIX = "difile://usr/";
export interface SaveWebFileOptions {
    appId: string;
    tempFilePath: string;
    filePath?: string;
    resourceBaseUrl: string;
    virtualFilePrefix?: string;
}
/**
 * Persist a Web temporary resource in the browser origin-private file system.
 * The returned virtual path matches the native Dimina FileSystemManager contract.
 */
export declare function saveWebFile(options: SaveWebFileOptions): Promise<string>;
/** Read a saved user file from this mini program's OPFS namespace. */
export declare function readWebFile(appId: string, filePath: string, virtualFilePrefix?: string): Promise<File>;
