using System.Globalization;

namespace Backend.Drivers;

public enum PlcValueDataType
{
    Bool,
    Int16,
    UInt16,
    Int32,
    UInt32,
    Float
}

public enum PlcPackUnitKind
{
    Bit,
    Word,
    Byte
}

public sealed record PlcEndpoint(
    string? Host,
    int? Port,
    string? SerialPort,
    int? BaudRate,
    byte? UnitId,
    int? Rack = null,
    int? Slot = null,
    string? CpuType = null,
    int? NetworkNo = null,
    int? StationNo = null,
    string? Frame = null);

public sealed record PlcConnectionConfig(
    string Id,
    string Name,
    string Protocol,
    string DriverKey,
    PlcEndpoint Endpoint);

public sealed record ReadItemRequest(string TagId, string Address, string DataType, string RwMode = "R");

public sealed record PlcWriteRequest(string Address, string DataType, IReadOnlyList<string> Values);

public sealed record ReadItemResult(string TagId, object? Value, string Quality, DateTimeOffset TimestampUtc, string? Error = null);

public sealed record PlcWriteResponse(bool Success, DateTimeOffset TimestampUtc, string? Error = null);

public sealed record NormalizedAddress(
    string ProtocolFamily,
    string MemoryArea,
    string DeviceCode,
    PlcPackUnitKind PackUnitKind,
    int StartUnit,
    int UnitSpan,
    int BitOffset,
    int ByteLength,
    int? DbNumber,
    PlcValueDataType DataType,
    string CanonicalAddress,
    bool IsBit)
{
    public int EndUnit => StartUnit + UnitSpan - 1;

    public string GroupKey => $"{ProtocolFamily}|{MemoryArea}|{DeviceCode}|{DbNumber?.ToString(CultureInfo.InvariantCulture) ?? "-"}|{PackUnitKind}";
}

public sealed record ReadPackItemBinding(ReadItemRequest Request, NormalizedAddress Address);

public sealed record ReadPack(
    string ConnectionId,
    string GroupKey,
    string ProtocolFamily,
    string MemoryArea,
    string DeviceCode,
    PlcPackUnitKind PackUnitKind,
    int StartUnit,
    int UnitCount,
    int? DbNumber,
    IReadOnlyList<ReadPackItemBinding> Items)
{
    public int EndUnit => StartUnit + UnitCount - 1;
}

public sealed record ReadPlan(
    IReadOnlyList<ReadPack> Packs,
    bool CacheHit,
    int RequestedItemCount,
    int PackedItemCount,
    int OriginalRequestCount);

public sealed record ReadBatchResponse(IReadOnlyList<ReadItemResult> Items, ReadBatchStats Stats);

public sealed record ReadBatchStats(int PackCount, int DriverRequestCount, long DurationMs, bool CacheHit);

public sealed record PackExecutionResult(
    DateTimeOffset TimestampUtc,
    IReadOnlyList<bool>? Bits = null,
    IReadOnlyList<ushort>? Words = null,
    byte[]? Bytes = null,
    int DriverRequestCount = 1);

public interface IPlcAdapter
{
    string DriverKey { get; }

    Task ConnectAsync(PlcConnectionConfig config, CancellationToken cancellationToken);

    Task DisconnectAsync(PlcConnectionConfig config, CancellationToken cancellationToken);

    Task<PackExecutionResult> ReadPackAsync(PlcConnectionConfig config, ReadPack pack, CancellationToken cancellationToken);

    Task<PlcWriteResponse> WriteAsync(PlcConnectionConfig config, PlcWriteRequest request, CancellationToken cancellationToken);
}

public sealed class PlcDriverException : Exception
{
    public PlcDriverException(string message) : base(message)
    {
    }

    public PlcDriverException(string message, Exception innerException) : base(message, innerException)
    {
    }
}

public static class PlcDataTypeParser
{
    public static PlcValueDataType Parse(string value)
    {
        var normalized = value?.Trim().ToLowerInvariant() ?? string.Empty;
        return normalized switch
        {
            "bool" or "boolean" => PlcValueDataType.Bool,
            "int16" or "short" => PlcValueDataType.Int16,
            "uint16" or "word" => PlcValueDataType.UInt16,
            "int32" or "dint" => PlcValueDataType.Int32,
            "uint32" or "dword" => PlcValueDataType.UInt32,
            "float" or "real" => PlcValueDataType.Float,
            _ => throw new PlcDriverException($"Unsupported data type '{value}'.")
        };
    }

    public static int GetWordCount(PlcValueDataType dataType)
    {
        return dataType switch
        {
            PlcValueDataType.Bool => 1,
            PlcValueDataType.Int16 => 1,
            PlcValueDataType.UInt16 => 1,
            PlcValueDataType.Int32 => 2,
            PlcValueDataType.UInt32 => 2,
            PlcValueDataType.Float => 2,
            _ => 1
        };
    }

    public static int GetByteCount(PlcValueDataType dataType)
    {
        return dataType switch
        {
            PlcValueDataType.Bool => 1,
            PlcValueDataType.Int16 => 2,
            PlcValueDataType.UInt16 => 2,
            PlcValueDataType.Int32 => 4,
            PlcValueDataType.UInt32 => 4,
            PlcValueDataType.Float => 4,
            _ => 2
        };
    }
}
