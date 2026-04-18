using System.Text.Json;
using Backend.Api;
using Backend.Data;
using Backend.Drivers;
using Backend.Drivers.Adapters;
using Backend.Drivers.Execution;
using Backend.Drivers.Parsing;
using Backend.Drivers.Planning;
using Backend.Services;
using Microsoft.Data.Sqlite;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddCors(options =>
{
    options.AddPolicy("local", policy =>
        policy.AllowAnyHeader().AllowAnyMethod().AllowAnyOrigin());
});

builder.Services.AddSingleton<Database>();
builder.Services.AddSingleton<MigrationRunner>();
builder.Services.AddSingleton<CrudService>();
builder.Services.AddSingleton<PlcAddressParser>();
builder.Services.AddSingleton<ReadPackPlanner>();
builder.Services.AddSingleton<PlcReadExecutor>();
builder.Services.AddSingleton<IPlcAdapter, FluentModbusAdapter>();
builder.Services.AddSingleton<IPlcAdapter, SiemensS7Adapter>();
builder.Services.AddSingleton<IPlcAdapter, MitsubishiMcpXAdapter>();
builder.Services.AddSingleton<IPlcAdapter, DeltaPlcAdapter>();
builder.Services.AddSingleton<ConnectionManager>();
builder.Services.AddSingleton<LogPipeline>();

var app = builder.Build();

app.UseCors("local");

using (var scope = app.Services.CreateScope())
{
    var migrationRunner = scope.ServiceProvider.GetRequiredService<MigrationRunner>();
    migrationRunner.Run();

    var crud = scope.ServiceProvider.GetRequiredService<CrudService>();
    var manager = scope.ServiceProvider.GetRequiredService<ConnectionManager>();
    var logs = scope.ServiceProvider.GetRequiredService<LogPipeline>();

    var persistedConnections = crud.GetConnections();
    foreach (var persisted in persistedConnections.Where(x => string.Equals(x.Status, "connected", StringComparison.OrdinalIgnoreCase)))
    {
        try
        {
            var endpoint = manager.ParseEndpointJson(persisted.Protocol, persisted.EndpointJson);
            await manager.RestoreConnectionAsync(
                persisted.Id,
                persisted.Name,
                persisted.Protocol,
                persisted.DriverKey,
                endpoint,
                CancellationToken.None);

            logs.AddLog("info", "connection_restored", persisted.Id, $"Driver={persisted.DriverKey}");
        }
        catch (Exception ex)
        {
            logs.AddLog("warn", "connection_restore_failed", persisted.Id, ex.Message);
            _ = crud.UpdateConnection(
                persisted.Id,
                new UpdateConnectionRequest(
                    persisted.Name,
                    persisted.Protocol,
                    persisted.DriverKey,
                    persisted.EndpointJson,
                    "disconnected"));
        }
    }
}

app.MapGet("/api/health", () => Results.Ok(new
{
    status = "ok",
    version = "0.3.0"
}));

app.MapGet("/api/connections", (CrudService crud) => Results.Ok(crud.GetConnections()));
app.MapPost("/api/connections", (CreateConnectionRequest request, CrudService crud, ConnectionManager manager) =>
{
    if (!ValidateCreateConnection(request, out var error))
    {
        return Results.BadRequest(new { message = error });
    }

    try
    {
        manager.ParseEndpointJson(request.Protocol, request.EndpointJson);
    }
    catch (Exception ex)
    {
        return Results.BadRequest(new { message = ex.Message });
    }

    return ExecuteWrite(() =>
    {
        var created = crud.CreateConnection(request);
        return Results.Created($"/api/connections/{created.Id}", created);
    });
});
app.MapPut("/api/connections/{id}", (string id, UpdateConnectionRequest request, CrudService crud, ConnectionManager manager) =>
{
    if (!ValidateId(id))
    {
        return Results.BadRequest(new { message = "id is required" });
    }

    if (!ValidateUpdateConnection(request, out var error))
    {
        return Results.BadRequest(new { message = error });
    }

    try
    {
        manager.ParseEndpointJson(request.Protocol, request.EndpointJson);
    }
    catch (Exception ex)
    {
        return Results.BadRequest(new { message = ex.Message });
    }

    return ExecuteWrite(() => crud.UpdateConnection(id, request) ? Results.Ok() : Results.NotFound());
});
app.MapDelete("/api/connections/{id}", (string id, CrudService crud) =>
{
    if (!ValidateId(id))
    {
        return Results.BadRequest(new { message = "id is required" });
    }

    return ExecuteWrite(() => crud.DeleteConnection(id) ? Results.Ok() : Results.NotFound());
});

app.MapPhase3Endpoints();

app.Run();

static IResult ExecuteWrite(Func<IResult> action)
{
    try
    {
        return action();
    }
    catch (SqliteException ex) when (ex.SqliteErrorCode == 19)
    {
        return Results.Conflict(new { message = "database constraint violation" });
    }
    catch (SqliteException)
    {
        return Results.BadRequest(new { message = "database operation failed" });
    }
}

static bool ValidateId(string id)
{
    return !string.IsNullOrWhiteSpace(id);
}

static bool ValidateCreateConnection(CreateConnectionRequest request, out string error)
{
    if (string.IsNullOrWhiteSpace(request.Name))
    {
        error = "name is required";
        return false;
    }

    if (string.IsNullOrWhiteSpace(request.Protocol))
    {
        error = "protocol is required";
        return false;
    }

    if (string.IsNullOrWhiteSpace(request.DriverKey))
    {
        error = "driverKey is required";
        return false;
    }

    if (!IsValidJson(request.EndpointJson))
    {
        error = "endpointJson must be valid json";
        return false;
    }

    error = string.Empty;
    return true;
}

static bool ValidateUpdateConnection(UpdateConnectionRequest request, out string error)
{
    if (string.IsNullOrWhiteSpace(request.Status))
    {
        error = "status is required";
        return false;
    }

    return ValidateCreateConnection(new CreateConnectionRequest(null, request.Name, request.Protocol, request.DriverKey, request.EndpointJson, request.Status), out error);
}

static bool IsValidJson(string value)
{
    if (string.IsNullOrWhiteSpace(value))
    {
        return false;
    }

    try
    {
        _ = JsonDocument.Parse(value);
        return true;
    }
    catch
    {
        return false;
    }
}

public partial class Program
{
}
