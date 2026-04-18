using Backend.Drivers;
using Backend.Drivers.Parsing;
using DBI.Drivers.Delta.PLC;

namespace Backend.Drivers.Adapters;

public sealed class DeltaPlcAdapter : IPlcAdapter
{
    private readonly Dictionary<string, DeltaClient> _clients = new(StringComparer.OrdinalIgnoreCase);
    private readonly PlcAddressParser _parser;
    private readonly object _sync = new();

    public DeltaPlcAdapter(PlcAddressParser parser)
    {
        _parser = parser;
    }

    public string DriverKey => "dbi-drivers";

    public Task ConnectAsync(PlcConnectionConfig config, CancellationToken cancellationToken)
    {
        var host = config.Endpoint.Host ?? throw new PlcDriverException("Host is required.");
        var port = config.Endpoint.Port ?? 502;
        var unitId = config.Endpoint.UnitId ?? (byte)1;
        var connectionType = config.Protocol switch
        {
            "Delta AS" => DeltaConnectionType.TcpAS,
            "Delta DVP" => DeltaConnectionType.TcpDVP,
            _ => throw new PlcDriverException($"Unsupported Delta protocol '{config.Protocol}'.")
        };

        lock (_sync)
        {
            if (_clients.TryGetValue(config.Id, out var existing) && existing.IsConnected)
            {
                return Task.CompletedTask;
            }

            existing?.Dispose();
            var client = new DeltaClient(host, port, connectionType, unitId);
            client.Connect();
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
                try
                {
                    client.Disconnect();
                }
                finally
                {
                    client.Dispose();
                }
            }
        }

        return Task.CompletedTask;
    }

    public Task<PackExecutionResult> ReadPackAsync(PlcConnectionConfig config, ReadPack pack, CancellationToken cancellationToken)
    {
        var client = GetClient(config.Id);
        return Task.FromResult(pack.PackUnitKind == PlcPackUnitKind.Bit
            ? new PackExecutionResult(DateTimeOffset.UtcNow, Bits: ReadBits(client, pack), DriverRequestCount: 1)
            : new PackExecutionResult(DateTimeOffset.UtcNow, Words: ReadWords(client, pack), DriverRequestCount: 1));
    }

    public Task<PlcWriteResponse> WriteAsync(PlcConnectionConfig config, PlcWriteRequest request, CancellationToken cancellationToken)
    {
        var client = GetClient(config.Id);
        var normalized = _parser.Parse(config, new ReadItemRequest("write", request.Address, request.DataType, "W"));

        try
        {
            if (normalized.PackUnitKind == PlcPackUnitKind.Bit)
            {
                var values = request.Values.Select(ParseBool).ToArray();
                WriteBits(client, normalized.DeviceCode, normalized.StartUnit, values);
            }
            else
            {
                WriteWords(client, normalized.DeviceCode, normalized.StartUnit, normalized.DataType, request.Values);
            }

            return Task.FromResult(new PlcWriteResponse(true, DateTimeOffset.UtcNow));
        }
        catch (Exception ex)
        {
            return Task.FromResult(new PlcWriteResponse(false, DateTimeOffset.UtcNow, ex.Message));
        }
    }

    private static IReadOnlyList<bool> ReadBits(DeltaClient client, ReadPack pack)
    {
        return pack.DeviceCode switch
        {
            "M" => client.ReadM(pack.StartUnit, pack.UnitCount),
            "X" => client.ReadX(pack.StartUnit, pack.UnitCount),
            "Y" => client.ReadY(pack.StartUnit, pack.UnitCount),
            "S" => client.ReadS(pack.StartUnit, pack.UnitCount),
            "TS" => client.ReadTStatus(pack.StartUnit, pack.UnitCount),
            "CS" => client.ReadCStatus(pack.StartUnit, pack.UnitCount),
            _ => throw new PlcDriverException($"Unsupported Delta bit area '{pack.DeviceCode}'.")
        };
    }

    private static IReadOnlyList<ushort> ReadWords(DeltaClient client, ReadPack pack)
    {
        return pack.DeviceCode switch
        {
            "D" => client.ReadD(pack.StartUnit, pack.UnitCount).Select(v => unchecked((ushort)v)).ToArray(),
            "T" or "TN" => client.ReadT(pack.StartUnit, pack.UnitCount).Select(v => unchecked((ushort)v)).ToArray(),
            "C" or "CN" => client.ReadC(pack.StartUnit, pack.UnitCount).Select(v => unchecked((ushort)v)).ToArray(),
            _ => throw new PlcDriverException($"Unsupported Delta word area '{pack.DeviceCode}'.")
        };
    }

    private static void WriteBits(DeltaClient client, string deviceCode, int start, bool[] values)
    {
        switch (deviceCode)
        {
            case "M": client.WriteM(start, values); break;
            case "Y": client.WriteY(start, values); break;
            case "S": client.WriteS(start, values); break;
            default: throw new PlcDriverException($"Write is not supported for Delta area '{deviceCode}'.");
        }
    }

    private static void WriteWords(DeltaClient client, string deviceCode, int start, PlcValueDataType dataType, IReadOnlyList<string> values)
    {
        if (deviceCode != "D")
        {
            throw new PlcDriverException($"Write is only enabled for Delta D area in v1, not '{deviceCode}'.");
        }

        switch (dataType)
        {
            case PlcValueDataType.Int16:
            case PlcValueDataType.UInt16:
                client.WriteD(start, values.Select(v => short.Parse(v)).ToArray());
                break;
            case PlcValueDataType.Int32:
            case PlcValueDataType.UInt32:
                client.WriteDIntArray(start, values.Select(v => int.Parse(v)).ToArray());
                break;
            case PlcValueDataType.Float:
                client.WriteFloatArray(start, values.Select(v => float.Parse(v)).ToArray());
                break;
            default:
                throw new PlcDriverException($"Unsupported Delta write data type '{dataType}'.");
        }
    }

    private DeltaClient GetClient(string connectionId)
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
