using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;
using Backend.Drivers.Parsing;

namespace Backend.Drivers.Planning;

public sealed class ReadPackPlanner
{
    private readonly PlcAddressParser _addressParser;
    private readonly ConcurrentDictionary<string, ReadPlan> _cache = new(StringComparer.Ordinal);

    public ReadPackPlanner(PlcAddressParser addressParser)
    {
        _addressParser = addressParser;
    }

    public ReadPlan BuildPlan(PlcConnectionConfig connection, IReadOnlyList<ReadItemRequest> items)
    {
        if (items.Count == 0)
        {
            return new ReadPlan(Array.Empty<ReadPack>(), false, 0, 0, 0);
        }

        var fingerprint = CreateFingerprint(connection, items);
        if (_cache.TryGetValue(fingerprint, out var cached))
        {
            return cached with { CacheHit = true };
        }

        var bindings = items.Select(item => new ReadPackItemBinding(item, _addressParser.Parse(connection, item))).ToList();
        var packs = BuildPacks(connection, bindings);
        var plan = new ReadPlan(packs, false, items.Count, bindings.Count, bindings.Count);
        _cache[fingerprint] = plan;
        return plan;
    }

    private static string CreateFingerprint(PlcConnectionConfig connection, IReadOnlyList<ReadItemRequest> items)
    {
        using var sha = SHA256.Create();
        var payload = string.Join("\n", items
            .OrderBy(x => x.TagId, StringComparer.OrdinalIgnoreCase)
            .Select(x => $"{x.TagId}|{x.Address.Trim().ToUpperInvariant()}|{x.DataType.Trim().ToLowerInvariant()}|{x.RwMode.Trim().ToUpperInvariant()}"));
        var input = $"{connection.Id}|{connection.Protocol}|{payload}";
        var hash = sha.ComputeHash(Encoding.UTF8.GetBytes(input));
        return Convert.ToHexString(hash);
    }

    private static IReadOnlyList<ReadPack> BuildPacks(PlcConnectionConfig connection, IReadOnlyList<ReadPackItemBinding> bindings)
    {
        var packs = new List<ReadPack>();
        var groups = bindings
            .GroupBy(x => x.Address.GroupKey, StringComparer.OrdinalIgnoreCase)
            .OrderBy(g => g.Key, StringComparer.OrdinalIgnoreCase);

        foreach (var group in groups)
        {
            var ordered = group.OrderBy(x => x.Address.StartUnit).ToList();
            var current = new List<ReadPackItemBinding>();
            var currentStart = -1;
            var currentEnd = -1;
            var sample = ordered[0].Address;
            var maxUnits = GetMaxUnits(sample);
            var allowedGap = sample.PackUnitKind switch
            {
                PlcPackUnitKind.Bit => 8,
                PlcPackUnitKind.Word => 2,
                PlcPackUnitKind.Byte => 2,
                _ => 0
            };

            foreach (var binding in ordered)
            {
                if (current.Count == 0)
                {
                    current.Add(binding);
                    currentStart = binding.Address.StartUnit;
                    currentEnd = binding.Address.EndUnit;
                    continue;
                }

                var candidateEnd = Math.Max(currentEnd, binding.Address.EndUnit);
                var candidateUnits = candidateEnd - currentStart + 1;
                var gap = binding.Address.StartUnit - currentEnd - 1;

                if (gap <= allowedGap && candidateUnits <= maxUnits)
                {
                    current.Add(binding);
                    currentEnd = candidateEnd;
                    continue;
                }

                packs.Add(CreatePack(connection, current, currentStart, currentEnd));
                current = new List<ReadPackItemBinding> { binding };
                currentStart = binding.Address.StartUnit;
                currentEnd = binding.Address.EndUnit;
            }

            if (current.Count > 0)
            {
                packs.Add(CreatePack(connection, current, currentStart, currentEnd));
            }
        }

        return packs;
    }

    private static ReadPack CreatePack(PlcConnectionConfig connection, IReadOnlyList<ReadPackItemBinding> items, int startUnit, int endUnit)
    {
        var first = items[0].Address;
        return new ReadPack(
            connection.Id,
            first.GroupKey,
            first.ProtocolFamily,
            first.MemoryArea,
            first.DeviceCode,
            first.PackUnitKind,
            startUnit,
            endUnit - startUnit + 1,
            first.DbNumber,
            items.ToList());
    }

    private static int GetMaxUnits(NormalizedAddress address)
    {
        return address.ProtocolFamily switch
        {
            "modbus" when address.PackUnitKind == PlcPackUnitKind.Bit => 2000,
            "modbus" when address.PackUnitKind == PlcPackUnitKind.Word => 125,
            "delta" when address.PackUnitKind == PlcPackUnitKind.Bit => 2000,
            "delta" when address.PackUnitKind == PlcPackUnitKind.Word => 125,
            "siemens" when address.PackUnitKind == PlcPackUnitKind.Byte => 200,
            "mitsubishi" when address.PackUnitKind == PlcPackUnitKind.Bit => 1024,
            "mitsubishi" when address.PackUnitKind == PlcPackUnitKind.Word => 256,
            _ => 125
        };
    }
}
