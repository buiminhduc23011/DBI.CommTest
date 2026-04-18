using System.Collections.Concurrent;
using System.Globalization;
using System.Text.Json;
using Backend.Drivers;

namespace Backend.Services;

public sealed class ConnectionManager
{
    private readonly IReadOnlyDictionary<string, IPlcAdapter> _adapters;
    private readonly ConcurrentDictionary<string, PlcConnectionConfig> _connections = new();

    public ConnectionManager(IEnumerable<IPlcAdapter> adapters)
    {
        _adapters = adapters.ToDictionary(a => a.DriverKey, StringComparer.OrdinalIgnoreCase);
    }

    public Task<PlcConnectionConfig> CreateConnectionAsync(
        string name,
        string protocol,
        string driverKey,
        PlcEndpoint endpoint,
        CancellationToken cancellationToken)
    {
        return ConnectAndStoreAsync(Guid.NewGuid().ToString("N"), name, protocol, driverKey, endpoint, cancellationToken);
    }

    public Task<PlcConnectionConfig> RestoreConnectionAsync(
        string id,
        string name,
        string protocol,
        string driverKey,
        PlcEndpoint endpoint,
        CancellationToken cancellationToken)
    {
        return ConnectAndStoreAsync(id, name, protocol, driverKey, endpoint, cancellationToken);
    }

    public bool Remove(string id)
    {
        return _connections.TryRemove(id, out _);
    }

    public async Task<bool> DisconnectAndRemoveAsync(string id, CancellationToken cancellationToken)
    {
        if (!_connections.TryRemove(id, out var config))
        {
            return false;
        }

        if (_adapters.TryGetValue(config.DriverKey, out var adapter))
        {
            await adapter.DisconnectAsync(config, cancellationToken);
        }

        return true;
    }

    public PlcConnectionConfig Get(string id)
    {
        if (_connections.TryGetValue(id, out var config))
        {
            return config;
        }

        throw new PlcDriverException($"Connection '{id}' not found.");
    }

    public IReadOnlyList<PlcConnectionConfig> List()
    {
        return _connections.Values.OrderBy(c => c.Name, StringComparer.OrdinalIgnoreCase).ToList();
    }

    public IPlcAdapter GetAdapter(string driverKey)
    {
        if (_adapters.TryGetValue(driverKey, out var adapter))
        {
            return adapter;
        }

        throw new PlcDriverException($"Unsupported driver '{driverKey}'.");
    }

    public PlcEndpoint ParseEndpointJson(string protocol, string endpointJson)
    {
        if (string.IsNullOrWhiteSpace(endpointJson))
        {
            throw new PlcDriverException("endpointJson is required.");
        }

        using var doc = JsonDocument.Parse(endpointJson);
        var root = doc.RootElement;

        string? host = TryGetString(root, "host");
        int? port = TryGetInt(root, "port");
        string? serialPort = TryGetString(root, "serialPort");
        int? baudRate = TryGetInt(root, "baudRate");
        byte? unitId = TryGetByte(root, "unitId") ?? (byte?)TryGetInt(root, "stationId");
        int? rack = TryGetInt(root, "rack");
        int? slot = TryGetInt(root, "slot");
        int? networkNo = TryGetInt(root, "networkNo");
        int? stationNo = TryGetInt(root, "stationNo");
        string? cpuType = TryGetString(root, "cpuType");
        string? frame = TryGetString(root, "frame");

        return new PlcEndpoint(host, port, serialPort, baudRate, unitId, rack, slot, cpuType, networkNo, stationNo, frame);
    }

    private async Task<PlcConnectionConfig> ConnectAndStoreAsync(
        string id,
        string name,
        string protocol,
        string driverKey,
        PlcEndpoint endpoint,
        CancellationToken cancellationToken)
    {
        if (!_adapters.TryGetValue(driverKey, out var adapter))
        {
            throw new PlcDriverException($"Unsupported driver '{driverKey}'.");
        }

        var config = new PlcConnectionConfig(id, name, protocol, driverKey, endpoint);
        await adapter.ConnectAsync(config, cancellationToken);
        _connections[id] = config;
        return config;
    }

    private static string? TryGetString(JsonElement root, string propertyName)
    {
        return root.TryGetProperty(propertyName, out var prop) && prop.ValueKind == JsonValueKind.String
            ? prop.GetString()
            : null;
    }

    private static int? TryGetInt(JsonElement root, string propertyName)
    {
        if (!root.TryGetProperty(propertyName, out var prop))
        {
            return null;
        }

        if (prop.ValueKind == JsonValueKind.Number && prop.TryGetInt32(out var number))
        {
            return number;
        }

        if (prop.ValueKind == JsonValueKind.String && int.TryParse(prop.GetString(), NumberStyles.Integer, CultureInfo.InvariantCulture, out var textNumber))
        {
            return textNumber;
        }

        return null;
    }

    private static byte? TryGetByte(JsonElement root, string propertyName)
    {
        if (!root.TryGetProperty(propertyName, out var prop))
        {
            return null;
        }

        if (prop.ValueKind == JsonValueKind.Number && prop.TryGetByte(out var number))
        {
            return number;
        }

        if (prop.ValueKind == JsonValueKind.String && byte.TryParse(prop.GetString(), NumberStyles.Integer, CultureInfo.InvariantCulture, out var textNumber))
        {
            return textNumber;
        }

        return null;
    }
}
