using Backend.Drivers;
using Backend.Drivers.Parsing;
using DBI.Drivers.Modbus.TCP;
using Microsoft.Extensions.Hosting;

namespace Backend.Drivers.Adapters;

public sealed class FluentModbusAdapter : IPlcAdapter
{
    private sealed class MockModbusMemory
    {
        public bool[] Coils { get; } = new bool[10000];
        public bool[] DiscreteInputs { get; } = new bool[10000];
        public ushort[] HoldingRegisters { get; } = new ushort[10000];
        public ushort[] InputRegisters { get; } = new ushort[10000];
    }

    private readonly Dictionary<string, ModbusTCPMaster> _clients = new(StringComparer.OrdinalIgnoreCase);
    private readonly Dictionary<string, MockModbusMemory> _mockMemories = new(StringComparer.OrdinalIgnoreCase);
    private readonly PlcAddressParser _parser;
    private readonly bool _useMockMode;
    private readonly object _sync = new();

    public FluentModbusAdapter(PlcAddressParser parser, IHostEnvironment environment)
    {
        _parser = parser;
        _useMockMode = string.Equals(environment.EnvironmentName, "IntegrationTests", StringComparison.OrdinalIgnoreCase);
    }

    public string DriverKey => "fluentmodbus";

    public Task ConnectAsync(PlcConnectionConfig config, CancellationToken cancellationToken)
    {
        if (_useMockMode)
        {
            lock (_sync)
            {
                if (!_mockMemories.ContainsKey(config.Id))
                {
                    _mockMemories[config.Id] = new MockModbusMemory();
                }
            }
            return Task.CompletedTask;
        }

        var host = config.Endpoint.Host ?? throw new PlcDriverException("Host is required.");
        var port = config.Endpoint.Port ?? 502;

        lock (_sync)
        {
            if (_clients.TryGetValue(config.Id, out var existing) && existing.IsConnected)
            {
                return Task.CompletedTask;
            }

            existing?.Dispose();
            var client = new ModbusTCPMaster(host, port);
            client.Connect();
            _clients[config.Id] = client;
        }

        return Task.CompletedTask;
    }

    public Task DisconnectAsync(PlcConnectionConfig config, CancellationToken cancellationToken)
    {
        lock (_sync)
        {
            _mockMemories.Remove(config.Id);
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
        if (_useMockMode)
        {
            var memory = GetMockMemory(config.Id);
            return Task.FromResult(ReadMockPack(memory, pack));
        }

        var client = GetClient(config.Id);
        var unitId = config.Endpoint.UnitId ?? (byte)1;
        return Task.FromResult(pack.PackUnitKind == PlcPackUnitKind.Bit
            ? ReadBits(client, unitId, pack)
            : ReadWords(client, unitId, pack));
    }

    public Task<PlcWriteResponse> WriteAsync(PlcConnectionConfig config, PlcWriteRequest request, CancellationToken cancellationToken)
    {
        var tempRequest = new ReadItemRequest("write", request.Address, request.DataType, "W");
        var normalized = _parser.Parse(config, tempRequest);

        try
        {
            if (_useMockMode)
            {
                WriteMock(config.Id, normalized, request.Values);
                return Task.FromResult(new PlcWriteResponse(true, DateTimeOffset.UtcNow));
            }

            var client = GetClient(config.Id);
            var unitId = config.Endpoint.UnitId ?? (byte)1;
            if (normalized.PackUnitKind == PlcPackUnitKind.Bit)
            {
                var values = request.Values.Select(ParseBool).ToArray();
                if (values.Length == 1)
                {
                    client.WriteSingleCoil(unitId, (uint)normalized.StartUnit, values[0]);
                }
                else
                {
                    client.WriteMultipleCoils(unitId, (uint)normalized.StartUnit, values);
                }
            }
            else
            {
                var words = request.Values.Select(ParseWord).ToArray();
                if (words.Length == 1)
                {
                    client.WriteSingleRegister(unitId, (uint)normalized.StartUnit, words[0]);
                }
                else
                {
                    client.WriteMultipleRegisters(unitId, (uint)normalized.StartUnit, words);
                }
            }

            return Task.FromResult(new PlcWriteResponse(true, DateTimeOffset.UtcNow));
        }
        catch (Exception ex)
        {
            return Task.FromResult(new PlcWriteResponse(false, DateTimeOffset.UtcNow, ex.Message));
        }
    }

    private static PackExecutionResult ReadMockPack(MockModbusMemory memory, ReadPack pack)
    {
        return pack.MemoryArea switch
        {
            "coil" => new PackExecutionResult(DateTimeOffset.UtcNow, Bits: memory.Coils.Skip(pack.StartUnit).Take(pack.UnitCount).ToArray(), DriverRequestCount: 1),
            "discrete-input" => new PackExecutionResult(DateTimeOffset.UtcNow, Bits: memory.DiscreteInputs.Skip(pack.StartUnit).Take(pack.UnitCount).ToArray(), DriverRequestCount: 1),
            "holding-register" => new PackExecutionResult(DateTimeOffset.UtcNow, Words: memory.HoldingRegisters.Skip(pack.StartUnit).Take(pack.UnitCount).ToArray(), DriverRequestCount: 1),
            "input-register" => new PackExecutionResult(DateTimeOffset.UtcNow, Words: memory.InputRegisters.Skip(pack.StartUnit).Take(pack.UnitCount).ToArray(), DriverRequestCount: 1),
            _ => throw new PlcDriverException($"Unsupported Modbus mock area '{pack.MemoryArea}'.")
        };
    }

    private void WriteMock(string connectionId, NormalizedAddress normalized, IReadOnlyList<string> values)
    {
        var memory = GetMockMemory(connectionId);
        if (normalized.PackUnitKind == PlcPackUnitKind.Bit)
        {
            var target = normalized.MemoryArea switch
            {
                "coil" => memory.Coils,
                "discrete-input" => memory.DiscreteInputs,
                _ => throw new PlcDriverException($"Unsupported mock bit area '{normalized.MemoryArea}'.")
            };

            for (var i = 0; i < values.Count; i++)
            {
                target[normalized.StartUnit + i] = ParseBool(values[i]);
            }
            return;
        }

        var wordTarget = normalized.MemoryArea switch
        {
            "holding-register" => memory.HoldingRegisters,
            "input-register" => memory.InputRegisters,
            _ => throw new PlcDriverException($"Unsupported mock word area '{normalized.MemoryArea}'.")
        };

        for (var i = 0; i < values.Count; i++)
        {
            wordTarget[normalized.StartUnit + i] = ParseWord(values[i]);
        }
    }

    private static PackExecutionResult ReadBits(ModbusTCPMaster client, byte unitId, ReadPack pack)
    {
        var bits = pack.MemoryArea switch
        {
            "coil" => client.ReadCoils(unitId, (uint)pack.StartUnit, (ushort)pack.UnitCount),
            "discrete-input" => client.ReadDiscreteInputs(unitId, (uint)pack.StartUnit, (ushort)pack.UnitCount),
            _ => throw new PlcDriverException($"Unsupported Modbus bit area '{pack.MemoryArea}'.")
        };

        return new PackExecutionResult(DateTimeOffset.UtcNow, Bits: bits, DriverRequestCount: 1);
    }

    private static PackExecutionResult ReadWords(ModbusTCPMaster client, byte unitId, ReadPack pack)
    {
        var words = pack.MemoryArea switch
        {
            "holding-register" => client.ReadHoldingRegisters(unitId, (uint)pack.StartUnit, (ushort)pack.UnitCount),
            "input-register" => client.ReadInputRegisters(unitId, (uint)pack.StartUnit, (ushort)pack.UnitCount),
            _ => throw new PlcDriverException($"Unsupported Modbus word area '{pack.MemoryArea}'.")
        };

        return new PackExecutionResult(DateTimeOffset.UtcNow, Words: words, DriverRequestCount: 1);
    }

    private ModbusTCPMaster GetClient(string connectionId)
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

    private MockModbusMemory GetMockMemory(string connectionId)
    {
        lock (_sync)
        {
            if (_mockMemories.TryGetValue(connectionId, out var memory))
            {
                return memory;
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

    private static ushort ParseWord(string value)
    {
        if (!ushort.TryParse(value, out var parsed))
        {
            throw new PlcDriverException($"Cannot parse word value '{value}'.");
        }

        return parsed;
    }
}
