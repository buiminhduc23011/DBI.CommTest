using Backend.Drivers;
using Backend.Drivers.Parsing;
using McpXLib;
using McpXLib.Enums;

namespace Backend.Drivers.Adapters;

public sealed class MitsubishiMcpXAdapter : IPlcAdapter
{
    private readonly Dictionary<string, McpX> _clients = new(StringComparer.OrdinalIgnoreCase);
    private readonly object _sync = new();
    private readonly PlcAddressParser _parser;

    public MitsubishiMcpXAdapter(PlcAddressParser parser)
    {
        _parser = parser;
    }

    public string DriverKey => "mcpx";

    public Task ConnectAsync(PlcConnectionConfig config, CancellationToken cancellationToken)
    {
        var host = config.Endpoint.Host ?? throw new PlcDriverException("Host is required.");
        var port = config.Endpoint.Port ?? 5007;

        lock (_sync)
        {
            if (_clients.ContainsKey(config.Id))
            {
                return Task.CompletedTask;
            }

            var client = new McpX(host, port, password: null, isAscii: false, isUdp: false, requestFrame: RequestFrame.E3, timeoutMilliseconds: 5000);
            _clients[config.Id] = client;
        }

        return Task.CompletedTask;
    }

    public Task DisconnectAsync(PlcConnectionConfig config, CancellationToken cancellationToken)
    {
        lock (_sync)
        {
            if (_clients.Remove(config.Id, out var client))
            {
                client.Dispose();
            }
        }

        return Task.CompletedTask;
    }

    public Task<PackExecutionResult> ReadPackAsync(PlcConnectionConfig config, ReadPack pack, CancellationToken cancellationToken)
    {
        var client = GetClient(config.Id);
        var prefix = ParsePrefix(pack.DeviceCode);

        if (pack.PackUnitKind == PlcPackUnitKind.Bit)
        {
            var bits = client.BatchReadBool(prefix, pack.StartUnit.ToString(), (ushort)pack.UnitCount);
            return Task.FromResult(new PackExecutionResult(DateTimeOffset.UtcNow, Bits: bits, DriverRequestCount: 1));
        }

        var words = client.BatchReadUInt16(prefix, pack.StartUnit.ToString(), (ushort)pack.UnitCount);
        return Task.FromResult(new PackExecutionResult(DateTimeOffset.UtcNow, Words: words, DriverRequestCount: 1));
    }

    public Task<PlcWriteResponse> WriteAsync(PlcConnectionConfig config, PlcWriteRequest request, CancellationToken cancellationToken)
    {
        var client = GetClient(config.Id);
        var normalized = _parser.Parse(config, new ReadItemRequest("write", request.Address, request.DataType, "W"));
        var prefix = ParsePrefix(normalized.DeviceCode);
        var address = normalized.StartUnit.ToString();

        try
        {
            if (normalized.PackUnitKind == PlcPackUnitKind.Bit)
            {
                var values = request.Values.Select(ParseBool).ToArray();
                if (values.Length == 1)
                {
                    client.WriteBool(prefix, address, values[0]);
                }
                else
                {
                    client.BatchWriteBool(prefix, address, values);
                }
            }
            else
            {
                switch (normalized.DataType)
                {
                    case PlcValueDataType.Int16:
                        client.BatchWriteInt16(prefix, address, request.Values.Select(v => short.Parse(v)).ToArray());
                        break;
                    case PlcValueDataType.UInt16:
                        client.BatchWriteUInt16(prefix, address, request.Values.Select(v => ushort.Parse(v)).ToArray());
                        break;
                    case PlcValueDataType.Int32:
                        client.BatchWriteInt32(prefix, address, request.Values.Select(v => int.Parse(v)).ToArray());
                        break;
                    case PlcValueDataType.UInt32:
                        client.BatchWriteUInt32(prefix, address, request.Values.Select(v => uint.Parse(v)).ToArray());
                        break;
                    case PlcValueDataType.Float:
                        client.BatchWriteSingle(prefix, address, request.Values.Select(v => float.Parse(v)).ToArray());
                        break;
                    default:
                        throw new PlcDriverException($"Unsupported Mitsubishi write data type '{normalized.DataType}'.");
                }
            }

            return Task.FromResult(new PlcWriteResponse(true, DateTimeOffset.UtcNow));
        }
        catch (Exception ex)
        {
            return Task.FromResult(new PlcWriteResponse(false, DateTimeOffset.UtcNow, ex.Message));
        }
    }

    private McpX GetClient(string connectionId)
    {
        lock (_sync)
        {
            if (_clients.TryGetValue(connectionId, out var client))
            {
                return client;
            }
        }

        throw new PlcDriverException($"Connection '{connectionId}' not found.");
    }

    private static Prefix ParsePrefix(string deviceCode)
    {
        return Enum.TryParse<Prefix>(deviceCode, ignoreCase: true, out var prefix)
            ? prefix
            : throw new PlcDriverException($"Unsupported Mitsubishi device code '{deviceCode}'.");
    }

    private static bool ParseBool(string value)
    {
        return value.Trim() switch
        {
            "1" => true,
            "0" => false,
            _ when bool.TryParse(value, out var parsed) => parsed,
            _ => throw new PlcDriverException($"Cannot parse bool value '{value}'.")
        };
    }
}
