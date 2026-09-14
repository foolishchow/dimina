import XCTest
import ZIPFoundation
@testable import dimina

final class DMPRemoteUpdateManagerTests: XCTestCase {
    func testActivatePendingUpdateSwitchesPackageAndPreservesPersistentFiles() async throws {
        let appId = "test-\(UUID().uuidString)"
        let appPath = DMPSandboxManager.appBundlePath(appId)
        let pendingPath = (DMPSandboxManager.sandboxPath() as NSString)
            .appendingPathComponent(".pending/\(appId)")
        defer { cleanup(appId: appId) }

        try write(config(appId: appId, versionCode: 1), to: (appPath as NSString).appendingPathComponent("config.json"))
        try write("old", to: (appPath as NSString).appendingPathComponent("main/logic.js"))
        try write("{}", to: (appPath as NSString).appendingPathComponent("main/app-config.json"))
        let userFile = (appPath as NSString).appendingPathComponent("store/saved.txt")
        try write("user", to: userFile)

        try write(config(appId: appId, versionCode: 2), to: (pendingPath as NSString).appendingPathComponent("config.json"))
        try write("new", to: (pendingPath as NSString).appendingPathComponent("main/logic.js"))
        try write("{}", to: (pendingPath as NSString).appendingPathComponent("main/app-config.json"))

        let activated = try await DMPRemoteUpdateManager.shared.activatePendingUpdate(appId: appId)

        XCTAssertTrue(activated)
        XCTAssertEqual(
            try String(contentsOfFile: (appPath as NSString).appendingPathComponent("main/logic.js")),
            "new"
        )
        XCTAssertEqual(try String(contentsOfFile: userFile), "user")
        XCTAssertFalse(FileManager.default.fileExists(atPath: pendingPath))
    }

    func testUninstallPreservesPersistentFilesAndRemovesPackageArtifacts() async throws {
        let appId = "test-\(UUID().uuidString)"
        let appPath = DMPSandboxManager.appBundlePath(appId)
        let pendingPath = (DMPSandboxManager.sandboxPath() as NSString)
            .appendingPathComponent(".pending/\(appId)")
        let remotePath = (DMPSandboxManager.sandboxPath() as NSString)
            .appendingPathComponent(".remote/\(appId)/2-test")
        let backupPath = (DMPSandboxManager.sandboxPath() as NSString)
            .appendingPathComponent(".backup/\(appId)/1")
        let downloadPath = (NSTemporaryDirectory() as NSString)
            .appendingPathComponent("dimina-updates/\(appId)/2.zip")
        defer { cleanup(appId: appId) }

        try write("logic", to: (appPath as NSString).appendingPathComponent("main/logic.js"))
        let userFile = (appPath as NSString).appendingPathComponent("store/saved.txt")
        try write("user", to: userFile)
        let tempFile = (appPath as NSString).appendingPathComponent("tmp/image.jpg")
        try write("temp", to: tempFile)
        try write("pending", to: (pendingPath as NSString).appendingPathComponent("main/logic.js"))
        try write("remote", to: (remotePath as NSString).appendingPathComponent("file"))
        try write("backup", to: (backupPath as NSString).appendingPathComponent("file"))
        try write("zip", to: downloadPath)

        try await DMPRemoteUpdateManager.shared.uninstallPackage(
            appId: appId,
            clearUserData: false
        )

        XCTAssertTrue(FileManager.default.fileExists(atPath: userFile))
        XCTAssertFalse(FileManager.default.fileExists(atPath: tempFile))
        XCTAssertFalse(FileManager.default.fileExists(atPath: pendingPath))
        XCTAssertFalse(FileManager.default.fileExists(atPath: remotePath))
        XCTAssertFalse(FileManager.default.fileExists(atPath: backupPath))
        XCTAssertFalse(FileManager.default.fileExists(atPath: downloadPath))
    }

    func testUninstallCanClearPersistentFiles() async throws {
        let appId = "test-\(UUID().uuidString)"
        let appPath = DMPSandboxManager.appBundlePath(appId)
        defer { cleanup(appId: appId) }
        try write("user", to: (appPath as NSString).appendingPathComponent("store/saved.txt"))

        try await DMPRemoteUpdateManager.shared.uninstallPackage(
            appId: appId,
            clearUserData: true
        )

        XCTAssertFalse(FileManager.default.fileExists(atPath: appPath))
    }

    @MainActor
    func testLocalInstallValidatesBeforePublishingAndSupportsDowngrade() async throws {
        let appId = "local-\(UUID().uuidString)"
        let manager = DMPAppManager.sharedInstance()
        let source = FileManager.default.temporaryDirectory.appendingPathComponent(appId)
        defer { cleanup(appId: appId); try? FileManager.default.removeItem(at: source) }
        func archive(version: Int, valid: Bool = true, id: String? = nil) throws -> URL {
            let directory = source.appendingPathComponent(UUID().uuidString)
            try write(config(appId: id ?? appId, versionCode: version), to: directory.appendingPathComponent("config.json").path)
            try write("{}", to: directory.appendingPathComponent("main/app-config.json").path)
            if valid { try write("v\(version)", to: directory.appendingPathComponent("main/logic.js").path) }
            let zip = source.appendingPathComponent("\(UUID().uuidString).zip")
            try FileManager.default.zipItem(at: directory, to: zip, shouldKeepParent: false)
            return zip
        }
        XCTAssertFalse(manager.isExistsApp(appId: appId))
        let zip = try archive(version: 2)
        _ = try await manager.installMiniProgram(appId: appId, packagePath: zip.path)
        XCTAssertTrue(FileManager.default.fileExists(atPath: zip.path))
        XCTAssertTrue(manager.isExistsApp(appId: appId))
        let userFile = DMPSandboxManager.appStoreResourceDirectoryPath(appId: appId) + "/keep"
        try write("user", to: userFile)
        for invalid in [try archive(version: 3, valid: false), try archive(version: 3, id: "other-app")] {
            do {
                _ = try await manager.installMiniProgram(appId: appId, packagePath: invalid.path)
                XCTFail("invalid package accepted")
            } catch { }
            XCTAssertEqual(try manager.getAppVersionInfo(appId: appId)?["versionCode"] as? Int, 2)
            XCTAssertEqual(try String(contentsOfFile: DMPSandboxManager.appServicePath(appId: appId), encoding: .utf8), "v2")
        }
        for version in [2, 1] {
            _ = try await manager.installMiniProgram(appId: appId, packagePath: archive(version: version).path)
            XCTAssertEqual(try manager.getAppVersionInfo(appId: appId)?["versionCode"] as? Int, version)
        }
        XCTAssertEqual(try manager.getAppVersionInfo(appId: appId)?["hostManaged"] as? Bool, true)
        XCTAssertEqual(try String(contentsOfFile: userFile, encoding: .utf8), "user")
        let bundled = source.appendingPathComponent("Host.bundle")
        let bundledApp = bundled.appendingPathComponent(appId)
        try write(config(appId: appId, versionCode: 99), to: bundledApp.appendingPathComponent("config.json").path)
        try write("bundled", to: bundledApp.appendingPathComponent("main/logic.js").path)
        try write("{}", to: bundledApp.appendingPathComponent("main/app-config.json").path)
        let previousBundle = DMPResourceManager.jsappBundle
        defer { DMPResourceManager.jsappBundle = previousBundle }
        DMPResourceManager.jsappBundle = try XCTUnwrap(Bundle(path: bundled.path))
        DMPResourceManager.prepareApp(appId: appId)
        XCTAssertEqual(try manager.getAppVersionInfo(appId: appId)?["versionCode"] as? Int, 1)
    }

    @MainActor
    func testLocalInstallRejectsDirectoryInPlaceOfLogicFile() async throws {
        let appId = "local-\(UUID().uuidString)"
        let source = FileManager.default.temporaryDirectory.appendingPathComponent(appId)
        let package = source.appendingPathComponent("package")
        defer { cleanup(appId: appId); try? FileManager.default.removeItem(at: source) }
        try write(config(appId: appId, versionCode: 1), to: package.appendingPathComponent("config.json").path)
        try write("{}", to: package.appendingPathComponent("main/app-config.json").path)
        try FileManager.default.createDirectory(at: package.appendingPathComponent("main/logic.js"), withIntermediateDirectories: true)
        let zip = source.appendingPathComponent("package.zip")
        try FileManager.default.zipItem(at: package, to: zip, shouldKeepParent: false)
        do {
            _ = try await DMPAppManager.sharedInstance().installMiniProgram(appId: appId, packagePath: zip.path)
            XCTFail("directory accepted as logic.js")
        } catch { }
    }

    private func write(_ value: String, to path: String) throws {
        try FileManager.default.createDirectory(
            atPath: (path as NSString).deletingLastPathComponent,
            withIntermediateDirectories: true,
            attributes: nil
        )
        try value.write(toFile: path, atomically: true, encoding: .utf8)
    }

    private func config(appId: String, versionCode: Int) -> String {
        return "{\"appId\":\"\(appId)\",\"versionCode\":\(versionCode)}"
    }

    private func cleanup(appId: String) {
        DMPFileUtil.removeItem(at: DMPSandboxManager.appBundlePath(appId))
        DMPFileUtil.removeItem(
            at: (DMPSandboxManager.sandboxPath() as NSString).appendingPathComponent(".pending/\(appId)")
        )
        DMPFileUtil.removeItem(
            at: (DMPSandboxManager.sandboxPath() as NSString).appendingPathComponent(".remote/\(appId)")
        )
        DMPFileUtil.removeItem(
            at: (DMPSandboxManager.sandboxPath() as NSString).appendingPathComponent(".backup/\(appId)")
        )
        DMPFileUtil.removeItem(
            at: (NSTemporaryDirectory() as NSString).appendingPathComponent("dimina-updates/\(appId)")
        )
    }
}
