using System.Collections.Concurrent;
using System.Globalization;
using System.Text.RegularExpressions;

namespace Backend.Drivers.Parsing;

public sealed class PlcAddressParser
{
    private static readonly Regex ModbusAliasRegex = new("^(?<prefix>C|DI|IR|HR)(?<number>\\d+)$", RegexOptions.Compiled | RegexOptions.IgnoreCase);
    private static readonly Regex ModbusStandardRegex = new("^(?<number>\\d{5,6})$", RegexOptions.Compiled);
    private static readonly Regex DeltaOrMitsuRegex = new("^(?<prefix>TN|CN|TC|CC|TS|CS|SN|SC|SS|ZR|SM|SD|DX|DY|D|M|X|Y|R|S|T|C|L|F|V|B|W|Z)(?<number>[0-9A-F]+)$", RegexOptions.Compiled | RegexOptions.IgnoreCase);
    private static readonly Regex SiemensDbBitRegex = new("^DB(?<db>\\d+)\\.DBX(?<byte>\\d+)\\.(?<bit>[0-7])$", RegexOptions.Compiled | RegexOptions.IgnoreCase);
    private static readonly Regex SiemensDbWordRegex = new("^DB(?<db>\\d+)\\.DB(?<kind>[BWD])(?<offset>\\d+)$", RegexOptions.Compiled | RegexOptions.IgnoreCase);
    private static readonly Regex SiemensAreaBitRegex = new("^(?<area>I|Q|M)(?<byte>\\d+)\\.(?<bit>[0-7])$", RegexOptions.Compiled | RegexOptions.IgnoreCase);
    private static readonly Regex SiemensAreaWordRegex = new("^(?<area>I|Q|M)(?<kind>B|W|D)(?<offset>\\d+)$", RegexOptions.Compiled | RegexOptions.IgnoreCase);

    private readonly ConcurrentDictionary<string, NormalizedAddress> _cache = new(StringComparer.OrdinalIgnoreCase);

    public bool TryGetCached(string cacheKey, out NormalizedAddress normalizedAddress)
    {
        return _cache.TryGetValue(cacheKey, out normalizedAddress!);
    }

    public NormalizedAddress Parse(PlcConnectionConfig connection, ReadItemRequest request)
    {
        var cacheKey = BuildCacheKey(connection.Protocol, request.Address, request.DataType);
        if (_cache.TryGetValue(cacheKey, out var cached))
        {
            return cached;
        }

        var protocol = connection.Protocol.Trim();
        var dataType = PlcDataTypeParser.Parse(request.DataType);
        var normalized = protocol switch
        {
            "Modbus TCP" or "modbus-tcp" => ParseModbus(request.Address, dataType),
            "Delta AS" or "Delta DVP" => ParseDelta(request.Address, dataType),
            "Siemens S7-1200" or "Siemens S7-1500" => ParseSiemens(request.Address, dataType),
            "Mitsubishi FX3U" or "Mitsubishi FX5U" => ParseMitsubishi(request.Address, dataType),
            _ => throw new PlcDriverException($"Unsupported protocol '{connection.Protocol}'.")
        };

        _cache[cacheKey] = normalized;
        return normalized;
    }

    private static string BuildCacheKey(string protocol, string address, string dataType)
    {
        return $"{protocol.Trim().ToLowerInvariant()}|{address.Trim().ToUpperInvariant()}|{dataType.Trim().ToLowerInvariant()}";
    }

    private static NormalizedAddress ParseModbus(string address, PlcValueDataType dataType)
    {
        var trimmed = address.Trim().ToUpperInvariant();

        var standardMatch = ModbusStandardRegex.Match(trimmed);
        if (standardMatch.Success)
        {
            var number = int.Parse(standardMatch.Groups["number"].Value, CultureInfo.InvariantCulture);
            return number switch
            {
                >= 1 and <= 9999 => new NormalizedAddress("modbus", "coil", "0X", PlcPackUnitKind.Bit, number - 1, 1, 0, 1, null, EnsureBool(dataType, address), trimmed.PadLeft(5, '0'), true),
                >= 10001 and <= 19999 => new NormalizedAddress("modbus", "discrete-input", "1X", PlcPackUnitKind.Bit, number - 10001, 1, 0, 1, null, EnsureBool(dataType, address), trimmed, true),
                >= 30001 and <= 39999 => new NormalizedAddress("modbus", "input-register", "3X", PlcPackUnitKind.Word, number - 30001, PlcDataTypeParser.GetWordCount(dataType), 0, PlcDataTypeParser.GetByteCount(dataType), null, dataType, trimmed, false),
                >= 40001 and <= 49999 => new NormalizedAddress("modbus", "holding-register", "4X", PlcPackUnitKind.Word, number - 40001, PlcDataTypeParser.GetWordCount(dataType), 0, PlcDataTypeParser.GetByteCount(dataType), null, dataType, trimmed, false),
                _ => throw new PlcDriverException($"Invalid Modbus address '{address}'. Use standard regions 00001/10001/30001/40001.")
            };
        }

        var aliasMatch = ModbusAliasRegex.Match(trimmed);
        if (!aliasMatch.Success)
        {
            throw new PlcDriverException($"Invalid Modbus address '{address}'. Use standard regions like 00001, 10001, 30001, 40001.");
        }

        var prefix = aliasMatch.Groups["prefix"].Value.ToUpperInvariant();
        var aliasNumber = int.Parse(aliasMatch.Groups["number"].Value, CultureInfo.InvariantCulture);

        return prefix switch
        {
            "C" => new NormalizedAddress("modbus", "coil", "0X", PlcPackUnitKind.Bit, aliasNumber - 1, 1, 0, 1, null, EnsureBool(dataType, address), trimmed, true),
            "DI" => new NormalizedAddress("modbus", "discrete-input", "1X", PlcPackUnitKind.Bit, aliasNumber - 1, 1, 0, 1, null, EnsureBool(dataType, address), trimmed, true),
            "IR" => new NormalizedAddress("modbus", "input-register", "3X", PlcPackUnitKind.Word, NormalizeRegister(aliasNumber, 30001), PlcDataTypeParser.GetWordCount(dataType), 0, PlcDataTypeParser.GetByteCount(dataType), null, dataType, trimmed, false),
            "HR" => new NormalizedAddress("modbus", "holding-register", "4X", PlcPackUnitKind.Word, NormalizeRegister(aliasNumber, 40001), PlcDataTypeParser.GetWordCount(dataType), 0, PlcDataTypeParser.GetByteCount(dataType), null, dataType, trimmed, false),
            _ => throw new PlcDriverException($"Unsupported Modbus area '{prefix}'.")
        };
    }

    private static int NormalizeRegister(int number, int baseAddress)
    {
        var offset = number >= baseAddress ? number - baseAddress : number;
        if (offset < 0)
        {
            throw new PlcDriverException($"Address '{number}' is below supported range.");
        }

        return offset;
    }

    private static NormalizedAddress ParseDelta(string address, PlcValueDataType dataType)
    {
        var match = DeltaOrMitsuRegex.Match(address.Trim());
        if (!match.Success)
        {
            throw new PlcDriverException($"Invalid Delta address '{address}'.");
        }

        var prefix = match.Groups["prefix"].Value.ToUpperInvariant();
        var numberToken = match.Groups["number"].Value.ToUpperInvariant();
        var isBit = prefix is "M" or "X" or "Y" or "S" or "TC" or "TS" or "CC" or "CS";
        var start = ParseDeviceNumber(prefix, numberToken);
        var canonical = $"{prefix}{numberToken}";

        return new NormalizedAddress(
            "delta",
            prefix,
            prefix,
            isBit ? PlcPackUnitKind.Bit : PlcPackUnitKind.Word,
            start,
            isBit ? 1 : PlcDataTypeParser.GetWordCount(dataType),
            0,
            isBit ? 1 : PlcDataTypeParser.GetByteCount(dataType),
            null,
            isBit ? EnsureBool(dataType, address) : dataType,
            canonical,
            isBit);
    }

    private static NormalizedAddress ParseMitsubishi(string address, PlcValueDataType dataType)
    {
        var match = DeltaOrMitsuRegex.Match(address.Trim());
        if (!match.Success)
        {
            throw new PlcDriverException($"Invalid Mitsubishi address '{address}'.");
        }

        var prefix = match.Groups["prefix"].Value.ToUpperInvariant();
        var numberToken = match.Groups["number"].Value.ToUpperInvariant();
        var isBit = prefix is "M" or "X" or "Y" or "TS" or "TC" or "CS" or "CC" or "SM";
        var start = ParseDeviceNumber(prefix, numberToken);
        var canonical = $"{prefix}{numberToken}";

        return new NormalizedAddress(
            "mitsubishi",
            prefix,
            prefix,
            isBit ? PlcPackUnitKind.Bit : PlcPackUnitKind.Word,
            start,
            isBit ? 1 : PlcDataTypeParser.GetWordCount(dataType),
            0,
            isBit ? 1 : PlcDataTypeParser.GetByteCount(dataType),
            null,
            isBit ? EnsureBool(dataType, address) : dataType,
            canonical,
            isBit);
    }

    private static int ParseDeviceNumber(string prefix, string token)
    {
        return prefix switch
        {
            "X" or "Y" or "B" or "W" or "DX" or "DY" => Convert.ToInt32(token, 16),
            _ => int.Parse(token, CultureInfo.InvariantCulture)
        };
    }

    private static NormalizedAddress ParseSiemens(string address, PlcValueDataType dataType)
    {
        var trimmed = address.Trim().ToUpperInvariant();

        var dbBit = SiemensDbBitRegex.Match(trimmed);
        if (dbBit.Success)
        {
            return new NormalizedAddress(
                "siemens",
                "DB",
                "DBX",
                PlcPackUnitKind.Byte,
                int.Parse(dbBit.Groups["byte"].Value, CultureInfo.InvariantCulture),
                1,
                int.Parse(dbBit.Groups["bit"].Value, CultureInfo.InvariantCulture),
                1,
                int.Parse(dbBit.Groups["db"].Value, CultureInfo.InvariantCulture),
                EnsureBool(dataType, address),
                trimmed,
                true);
        }

        var dbWord = SiemensDbWordRegex.Match(trimmed);
        if (dbWord.Success)
        {
            var kind = dbWord.Groups["kind"].Value.ToUpperInvariant();
            var offset = int.Parse(dbWord.Groups["offset"].Value, CultureInfo.InvariantCulture);
            return ParseSiemensByteAddress(trimmed, dataType, "DB", $"DB{kind}", int.Parse(dbWord.Groups["db"].Value, CultureInfo.InvariantCulture), kind, offset);
        }

        var areaBit = SiemensAreaBitRegex.Match(trimmed);
        if (areaBit.Success)
        {
            var area = areaBit.Groups["area"].Value.ToUpperInvariant();
            return new NormalizedAddress(
                "siemens",
                area,
                $"{area}X",
                PlcPackUnitKind.Byte,
                int.Parse(areaBit.Groups["byte"].Value, CultureInfo.InvariantCulture),
                1,
                int.Parse(areaBit.Groups["bit"].Value, CultureInfo.InvariantCulture),
                1,
                null,
                EnsureBool(dataType, address),
                trimmed,
                true);
        }

        var areaWord = SiemensAreaWordRegex.Match(trimmed);
        if (areaWord.Success)
        {
            var area = areaWord.Groups["area"].Value.ToUpperInvariant();
            var kind = areaWord.Groups["kind"].Value.ToUpperInvariant();
            var offset = int.Parse(areaWord.Groups["offset"].Value, CultureInfo.InvariantCulture);
            return ParseSiemensByteAddress(trimmed, dataType, area, $"{area}{kind}", null, kind, offset);
        }

        throw new PlcDriverException($"Invalid Siemens address '{address}'.");
    }

    private static NormalizedAddress ParseSiemensByteAddress(string canonical, PlcValueDataType dataType, string memoryArea, string deviceCode, int? dbNumber, string kind, int offset)
    {
        var span = kind switch
        {
            "B" => 1,
            "W" => Math.Max(2, PlcDataTypeParser.GetByteCount(dataType)),
            "D" => Math.Max(4, PlcDataTypeParser.GetByteCount(dataType)),
            _ => throw new PlcDriverException($"Unsupported Siemens data selector '{kind}'.")
        };

        return new NormalizedAddress(
            "siemens",
            memoryArea,
            deviceCode,
            PlcPackUnitKind.Byte,
            offset,
            span,
            0,
            span,
            dbNumber,
            dataType,
            canonical,
            false);
    }

    private static PlcValueDataType EnsureBool(PlcValueDataType dataType, string address)
    {
        if (dataType != PlcValueDataType.Bool)
        {
            throw new PlcDriverException($"Address '{address}' only supports Bool data type.");
        }

        return dataType;
    }
}
