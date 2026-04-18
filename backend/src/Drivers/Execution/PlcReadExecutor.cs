using System.Buffers.Binary;
using Backend.Drivers.Planning;

namespace Backend.Drivers.Execution;

public sealed class PlcReadExecutor
{
    private readonly ReadPackPlanner _planner;

    public PlcReadExecutor(ReadPackPlanner planner)
    {
        _planner = planner;
    }

    public async Task<ReadBatchResponse> ExecuteAsync(
        PlcConnectionConfig connection,
        IPlcAdapter adapter,
        IReadOnlyList<ReadItemRequest> items,
        CancellationToken cancellationToken)
    {
        var started = DateTimeOffset.UtcNow;
        var plan = _planner.BuildPlan(connection, items);
        var results = new List<ReadItemResult>(items.Count);
        var driverRequestCount = 0;

        foreach (var pack in plan.Packs)
        {
            try
            {
                var packResult = await adapter.ReadPackAsync(connection, pack, cancellationToken);
                driverRequestCount += packResult.DriverRequestCount;
                foreach (var item in pack.Items)
                {
                    results.Add(new ReadItemResult(item.Request.TagId, Decode(item.Address, pack, packResult), "Good", packResult.TimestampUtc));
                }
            }
            catch (Exception ex)
            {
                driverRequestCount += 1;
                foreach (var item in pack.Items)
                {
                    results.Add(new ReadItemResult(item.Request.TagId, null, "Timeout", DateTimeOffset.UtcNow, ex.Message));
                }
            }
        }

        var ordered = items
            .Select(request => results.FirstOrDefault(x => string.Equals(x.TagId, request.TagId, StringComparison.Ordinal))
                ?? new ReadItemResult(request.TagId, null, "Bad", DateTimeOffset.UtcNow, "No result returned."))
            .ToList();

        var duration = (long)(DateTimeOffset.UtcNow - started).TotalMilliseconds;
        return new ReadBatchResponse(ordered, new ReadBatchStats(plan.Packs.Count, driverRequestCount, duration, plan.CacheHit));
    }

    private static object Decode(NormalizedAddress address, ReadPack pack, PackExecutionResult result)
    {
        return address.ProtocolFamily switch
        {
            "siemens" => DecodeSiemens(address, pack, result),
            _ when address.PackUnitKind == PlcPackUnitKind.Bit => DecodeBit(address, pack, result),
            _ => DecodeWord(address, pack, result)
        };
    }

    private static object DecodeBit(NormalizedAddress address, ReadPack pack, PackExecutionResult result)
    {
        if (result.Bits is { Count: > 0 })
        {
            var index = address.StartUnit - pack.StartUnit;
            if (index < 0 || index >= result.Bits.Count)
            {
                throw new PlcDriverException($"Bit result for '{address.CanonicalAddress}' is out of pack range.");
            }

            return result.Bits[index];
        }

        if (result.Bytes is { Length: > 0 })
        {
            var byteIndex = address.StartUnit - pack.StartUnit;
            if (byteIndex < 0 || byteIndex >= result.Bytes.Length)
            {
                throw new PlcDriverException($"Byte result for '{address.CanonicalAddress}' is out of pack range.");
            }

            return (result.Bytes[byteIndex] & (1 << address.BitOffset)) != 0;
        }

        throw new PlcDriverException($"No bit payload returned for '{address.CanonicalAddress}'.");
    }

    private static object DecodeWord(NormalizedAddress address, ReadPack pack, PackExecutionResult result)
    {
        if (result.Words is null || result.Words.Count == 0)
        {
            throw new PlcDriverException($"No word payload returned for '{address.CanonicalAddress}'.");
        }

        var index = address.StartUnit - pack.StartUnit;
        if (index < 0 || index >= result.Words.Count)
        {
            throw new PlcDriverException($"Word result for '{address.CanonicalAddress}' is out of pack range.");
        }

        return address.DataType switch
        {
            PlcValueDataType.Int16 => unchecked((short)result.Words[index]),
            PlcValueDataType.UInt16 => result.Words[index],
            PlcValueDataType.Int32 => CombineWord32(result.Words, index, signed: true),
            PlcValueDataType.UInt32 => CombineWord32(result.Words, index, signed: false),
            PlcValueDataType.Float => WordArrayToFloat(result.Words, index),
            PlcValueDataType.Bool => result.Words[index] != 0,
            _ => result.Words[index]
        };
    }

    private static object DecodeSiemens(NormalizedAddress address, ReadPack pack, PackExecutionResult result)
    {
        if (address.IsBit)
        {
            return DecodeBit(address, pack, result);
        }

        var buffer = result.Bytes ?? throw new PlcDriverException($"No byte payload returned for '{address.CanonicalAddress}'.");
        var offset = address.StartUnit - pack.StartUnit;
        var span = buffer.AsSpan(offset, address.ByteLength);

        return address.DataType switch
        {
            PlcValueDataType.Int16 => BinaryPrimitives.ReadInt16BigEndian(span),
            PlcValueDataType.UInt16 => BinaryPrimitives.ReadUInt16BigEndian(span),
            PlcValueDataType.Int32 => BinaryPrimitives.ReadInt32BigEndian(span),
            PlcValueDataType.UInt32 => BinaryPrimitives.ReadUInt32BigEndian(span),
            PlcValueDataType.Float => BinaryPrimitives.ReadSingleBigEndian(span),
            PlcValueDataType.Bool => span[0] != 0,
            _ => BinaryPrimitives.ReadUInt16BigEndian(span)
        };
    }

    private static int CombineWord32(IReadOnlyList<ushort> words, int startIndex, bool signed)
    {
        if (startIndex + 1 >= words.Count)
        {
            throw new PlcDriverException("Insufficient words for 32-bit decode.");
        }

        var raw = (uint)((words[startIndex] << 16) | words[startIndex + 1]);
        return signed ? unchecked((int)raw) : unchecked((int)raw);
    }

    private static float WordArrayToFloat(IReadOnlyList<ushort> words, int startIndex)
    {
        if (startIndex + 1 >= words.Count)
        {
            throw new PlcDriverException("Insufficient words for float decode.");
        }

        Span<byte> bytes = stackalloc byte[4];
        BinaryPrimitives.WriteUInt16BigEndian(bytes[..2], words[startIndex]);
        BinaryPrimitives.WriteUInt16BigEndian(bytes[2..], words[startIndex + 1]);
        return BinaryPrimitives.ReadSingleBigEndian(bytes);
    }
}
