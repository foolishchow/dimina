import UIKit

/// All provider operations and callbacks are confined to the main thread.
@MainActor public protocol DMPMapProvider {
    func create(events: DMPMapEvents) throws -> any DMPMapInstance
}
@MainActor public protocol DMPMapInstance: AnyObject {
    var view: UIView { get }
    func update(_ props: [String: Any]) throws
    func invoke(_ command: String, args: [String: Any], completion: @escaping (Result<[String: Any], Error>) -> Void)
    func destroy()
}
@MainActor public struct DMPMapEvents {
    public let ready: () -> Void
    public let event: (String, [String: Any]) -> Void
    public let error: (String) -> Void
}
public struct DMPMapError: LocalizedError {
    public let message: String
    public init(_ message: String) { self.message = message }
    public var errorDescription: String? { message }
}
@MainActor public enum DMPMapProviders {
    private static var providers: [String: any DMPMapProvider] = [:]
    private static var selected: String?
    public static func register(_ name: String, provider: any DMPMapProvider, select: Bool = true) {
        providers[name] = provider
        if select { selected = name }
    }
    public static func select(_ name: String) throws {
        guard providers[name] != nil else { throw DMPMapError("Map provider is not registered: \(name)") }
        selected = name
    }
    static func create(events: DMPMapEvents) throws -> any DMPMapInstance {
        guard let selected, let provider = providers[selected] else { throw DMPMapError("Native map provider is not configured") }
        return try provider.create(events: events)
    }
}
