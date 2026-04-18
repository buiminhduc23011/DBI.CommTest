using Backend.Drivers;
using Backend.Drivers.Parsing;
using Sharp7;

namespace Backend.Drivers.Adapters;

public sealed class SiemensS7Adapter : IPlcAdapter
{
    private readonly Dictionary<string, S7Client> _clients = new(StringComparer.OrdinalIgnoreCase);
    private readonly object _sync = new();
    private readonly PlcAddressParser _parser;

    public SiemensS7Adapter(PlcAddressParser parser)
    {
        _parser = parser;
    }

    public string DriverKey => "sharp7";

    public Task ConnectAsync(PlcConnectionConfig config, CancellationToken cancellationToken)
    {
        var host = config.Endpoint.Host ?? throw new PlcDriverException("Host is required.");
        var rack = config.Endpoint.Rack ?? 0;
        var slot = config.Endpoint.Slot ?? 1;

        lock (_sync)
        {
            if (_clients.TryGetValue(config.Id, out var existing) && existing.Connected)
            {
                return Task.CompletedTask;
            }

            existing?.Disconnect();
            var client = new S7Client();
            var result = client.ConnectTo(host, rack, slot);
            if (result != 0)
            {
                throw new PlcDriverException($"Sharp7 connect failed: {client.ErrorText(result)}");
            }

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
                client.Disconnect();
            }
        }

        return Task.CompletedTask;
    }

    public Task<PackExecutionResult> ReadPackAsync(PlcConnectionConfig config, ReadPack pack, CancellationToken cancellationToken)
    {
        var client = GetClient(config.Id);
        var buffer = new byte[pack.UnitCount];
        var area = pack.MemoryArea switch
        {
            "DB" => S7Area.DB,
            "M" => S7Area.MK,
            "I" => S7Area.PE,
            "Q" => S7Area.PA,
            _ => throw new PlcDriverException($"Unsupported Siemens area '{pack.MemoryArea}'.")
        };
        var dbNumber = pack.DbNumber ?? 0;
        var result = client.ReadArea(area, dbNumber, pack.StartUnit, pack.UnitCount, S7WordLength.Byte, buffer);
        if (result != 0)
        {
            throw new PlcDriverException($"Sharp7 read failed: {client.ErrorText(result)}");
        }

        return Task.FromResult(new PackExecutionResult(DateTimeOffset.UtcNow, Bytes: buffer, DriverRequestCount: 1));
    }

    public Task<PlcWriteResponse> WriteAsync(PlcConnectionConfig config, PlcWriteRequest request, CancellationToken cancellationToken)
    {
        var client = GetClient(config.Id);
        var address = _parser.Parse(config, new ReadItemRequest("write", request.Address, request.DataType, "W"));
        var area = address.MemoryArea switch
        {
            "DB" => S7Area.DB,
            "M" => S7Area.MK,
            "I" => S7Area.PE,
            "Q" => S7Area.PA,
            _ => throw new PlcDriverException($"Unsupported Siemens area '{address.MemoryArea}'.")
        };
        var dbNumber = address.DbNumber ?? 0;

        try
        {
            if (address.IsBit)
            {
                var value = ParseBool(request.Values[0]);
                var buffer = new[] { value ? (byte)(1 << address.BitOffset) : (byte)0 };
                var resultBit = client.WriteArea(area, dbNumber, address.StartUnit, 1, S7WordLength.Bit, buffer);
                if (resultBit != 0)
                {
                    throw new PlcDriverException($"Sharp7 write failed: {client.ErrorText(resultBit)}");
                }
            }
            else
            {
                var buffer = BuildWriteBuffer(address.DataType, request.Values);
                var resultWrite = client.WriteArea(area, dbNumber, address.StartUnit, buffer.Length, S7WordLength.Byte, buffer);
                if (resultWrite != 0)
                {
                    throw new PlcDriverException($"Sharp7 write failed: {client.ErrorText(resultWrite)}");
                }
            }

            return Task.FromResult(new PlcWriteResponse(true, DateTimeOffset.UtcNow));
        }
        catch (Exception ex)
        {
            return Task.FromResult(new PlcWriteResponse(false, DateTimeOffset.UtcNow, ex.Message));
        }
    }

    private S7Client GetClient(string connectionId)
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

    private static byte[] BuildWriteBuffer(PlcValueDataType dataType, IReadOnlyList<string> values)
    {
        var buffer = new List<byte>();
        foreach (var value in values)
        {
            switch (dataType)
            {
                case PlcValueDataType.Int16:
                    var int16 = short.Parse(value);
                    buffer.Add((byte)((int16 >> 8) & 0xFF));
                    buffer.Add((byte)(int16 & 0xFF));
                    break;
                case PlcValueDataType.UInt16:
                    var uint16 = ushort.Parse(value);
                    buffer.Add((byte)((uint16 >> 8) & 0xFF));
                    buffer.Add((byte)(uint16 & 0xFF));
                    break;
                case PlcValueDataType.Int32:
                    var int32 = int.Parse(value);
                    buffer.Add((byte)((int32 >> 24) & 0xFF));
                    buffer.Add((byte)((int32 >> 16) & 0xFF));
                    buffer.Add((byte)((int32 >> 8) & 0xFF));
                    buffer.Add((byte)(int32 & 0xFF));
                    break;
                case PlcValueDataType.UInt32:
                    var uint32 = uint.Parse(value);
                    buffer.Add((byte)((uint32 >> 24) & 0xFF));
                    buffer.Add((byte)((uint32 >> 16) & 0xFF));
                    buffer.Add((byte)((uint32 >> 8) & 0xFF));
                    buffer.Add((byte)(uint32 & 0xFF));
                    break;
                case PlcValueDataType.Float:
                    var floatBytes = BitConverter.GetBytes(float.Parse(value));
                    if (BitConverter.IsLittleEndian)
                    {
                        Array.Reverse(floatBytes);
                    }
                    buffer.AddRange(floatBytes);
                    break;
                default:
                    throw new PlcDriverException($"Unsupported Siemens write data type '{dataType}'.");
            }
        }

        return buffer.ToArray();
    }
}
