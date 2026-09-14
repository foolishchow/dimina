//
//  DMPServiceRenderOrderTests.swift
//  DiminaKitTests
//
//  Guards the invariant that messages published by the render layer reach the
//  service JS in the order they were published. One touch is dispatched
//  synchronously through the DOM, so every node on the path publishes its tap
//  back to back; if delivery reorders them, the page sees an event sequence the
//  render layer never produced. The container -> service direction carries the
//  same invariant (see DMPService.fromContainer), and both break the same way:
//  wrapping each message in its own unstructured Task hands ordering to the
//  concurrent thread pool.

import JavaScriptCore
import XCTest
@testable import dimina

final class DMPServiceRenderOrderTests: XCTestCase {

    func testDebugFlagIsAvailableBeforeFirstServiceScript() async {
        for enabled in [false, true] {
            let engine = DMPEngine(debugEnabled: enabled)
            let result = await engine.evaluateScript("globalThis.__diminaDebug === \(enabled ? "true" : "false")")
            XCTAssertEqual(result?.toBool(), true)
            let snapshotHook = await engine.evaluateScript("typeof globalThis.__diminaDebugStorageSnapshot === '\(enabled ? "function" : "undefined")'")
            XCTAssertEqual(snapshotHook?.toBool(), true)
            engine.destroy()
        }
    }

    func testResourceMessageAdvertisesNativeStorageOnlyWhenEnabled() {
        for enabled in [false, true] {
            let body = DMPContainer.makeResourceBody(
                webViewId: 7, appId: "debug-app", pagePath: "pages/index", root: "main",
                launchConfig: nil, debugEnabled: enabled
            )
            XCTAssertEqual(body["debugEnabled"] as? String, enabled ? "true" : "false")
        }
    }

    func testStorageSnapshotReadsPersistedMMKVForCurrentAppOnly() {
        let appId = "vconsole-test-\(UUID().uuidString)"
        let otherId = "vconsole-test-\(UUID().uuidString)"
        defer {
            DMPStorage.storage(for: appId).clearAllStorage()
            DMPStorage.teardownModule(appId: appId)
            DMPStorage.teardownModule(appId: otherId)
        }
        XCTAssertTrue(DMPStorage.storage(for: appId).set(key: "persisted", value: ["issue": 334]))
        XCTAssertTrue(DMPStorage.storage(for: appId).set(key: "persisted", value: "encrypted", encrypted: true))
        DMPStorage.teardownModule(appId: appId)
        let storage = DMPStorage.storage(for: appId)
        XCTAssertTrue(storage.getAllStorageInfo().keys.contains("persisted"))
        XCTAssertEqual((storage.get(key: "persisted") as? [String: Int])?["issue"], 334)
        let snapshot = storage.debugSnapshot()
        XCTAssertEqual(snapshot.count, 2)
        XCTAssertEqual(snapshot.first { $0["encrypted"] as? Bool == true }?["data"] as? String, "encrypted")
        XCTAssertEqual((snapshot.first { $0["encrypted"] as? Bool == false }?["data"] as? [String: Int])?["issue"], 334)
        XCTAssertFalse(DMPStorage.storage(for: otherId).getAllStorageInfo().keys.contains("persisted"))
    }

    private func makeService() -> DMPService {
        let app = DMPApp(appConfig: DMPAppConfig(appName: "order", appId: "orderApp"), appIndex: 0)
        let service = DMPService(app: app)
        let ready = expectation(description: "engine initialized")
        service.getEngine().onInitialized { ready.fulfill() }
        wait(for: [ready], timeout: 5)
        return service
    }

    func test_fromRender_deliversMessagesInPublishOrder() {
        let service = makeService()
        defer { service.destroy() }

        let engine = service.getEngine()
        let messageCount = 50
        let received = ThreadSafeEventLog()
        let allArrived = expectation(description: "all messages arrived")

        engine.registerMethod(name: "__recordOrder") { value in
            received.record(String(value.toInt32()))
            if received.events.count == messageCount {
                allArrived.fulfill()
            }
            return nil
        }

        let bridgeReady = expectation(description: "bridge defined")
        Task {
            await engine.evaluateScript(
                "var DiminaServiceBridge = { onMessage: function (msg) { __recordOrder(msg.seq) } };"
            )
            bridgeReady.fulfill()
        }
        wait(for: [bridgeReady], timeout: 5)

        // Published back to back from one thread, exactly as a single touch does.
        for seq in 0..<messageCount {
            service.fromRender(data: "{\"seq\":\(seq)}")
        }

        wait(for: [allArrived], timeout: 10)

        XCTAssertEqual(received.events, (0..<messageCount).map(String.init),
                       "render -> service delivery reordered the messages")
    }
}
