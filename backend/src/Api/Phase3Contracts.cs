namespace Backend.Api;

public sealed record RuntimeCreateConnectionRequest(
    string Name,
    string Protocol,
    string DriverKey,
    string? Host,
    int? Port,
    string? SerialPort,
    int? BaudRate,
    byte? UnitId,
    int? Rack,
    int? Slot,
    string? CpuType,
    int? NetworkNo,
    int? StationNo,
    string? Frame);

public sealed record RuntimeReadItemRequest(string TagId, string Address, string DataType, string RwMode = "R");

public sealed record RuntimeReadRequest(IReadOnlyList<RuntimeReadItemRequest> Items);

public sealed record RuntimeWriteRequest(string Address, string DataType, IReadOnlyList<string> Values);

public sealed record ApiErrorResponse(string Code, string Message, object? Details = null);
