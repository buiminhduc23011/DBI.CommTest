using System.Collections.Concurrent;

namespace Backend.Services;

public sealed record StructuredLogEntry(
    DateTimeOffset TimestampUtc,
    string Level,
    string Event,
    string? ConnectionId,
    string Details);

public sealed record CommunicationTraceEntry(
    DateTimeOffset TimestampUtc,
    string ConnectionId,
    string DriverKey,
    string Direction,
    string Payload);

public sealed class LogPipeline
{
    private readonly ConcurrentQueue<StructuredLogEntry> _structuredLogs = new();
    private readonly ConcurrentQueue<CommunicationTraceEntry> _traces = new();

    public void AddLog(string level, string @event, string? connectionId, string details)
    {
        _structuredLogs.Enqueue(new StructuredLogEntry(DateTimeOffset.UtcNow, level, @event, connectionId, details));
        TrimStructured();
    }

    public void AddTrace(string connectionId, string driverKey, string direction, string payload)
    {
        _traces.Enqueue(new CommunicationTraceEntry(DateTimeOffset.UtcNow, connectionId, driverKey, direction, payload));
        TrimTrace();
    }

    public IReadOnlyList<StructuredLogEntry> GetStructuredLogs()
    {
        return _structuredLogs.ToArray();
    }

    public IReadOnlyList<CommunicationTraceEntry> GetTraces()
    {
        return _traces.ToArray();
    }

    private void TrimStructured()
    {
        while (_structuredLogs.Count > 5000)
        {
            _structuredLogs.TryDequeue(out _);
        }
    }

    private void TrimTrace()
    {
        while (_traces.Count > 5000)
        {
            _traces.TryDequeue(out _);
        }
    }
}
