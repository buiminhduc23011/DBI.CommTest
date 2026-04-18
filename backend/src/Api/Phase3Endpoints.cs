using Backend.Drivers;
using Backend.Drivers.Execution;
using Backend.Services;

namespace Backend.Api;

public static class Phase3Endpoints
{
    public static void MapPhase3Endpoints(this IEndpointRouteBuilder app)
    {
        app.MapPost("/api/runtime/connections", async (
            RuntimeCreateConnectionRequest request,
            ConnectionManager manager,
            LogPipeline logs,
            CancellationToken cancellationToken) =>
        {
            try
            {
                var endpoint = new PlcEndpoint(
                    request.Host,
                    request.Port,
                    request.SerialPort,
                    request.BaudRate,
                    request.UnitId,
                    request.Rack,
                    request.Slot,
                    request.CpuType,
                    request.NetworkNo,
                    request.StationNo,
                    request.Frame);

                var connection = await manager.CreateConnectionAsync(request.Name, request.Protocol, request.DriverKey, endpoint, cancellationToken);
                logs.AddLog("info", "connection_created", connection.Id, $"Driver={connection.DriverKey}");
                return Results.Created($"/api/runtime/connections/{connection.Id}", connection);
            }
            catch (PlcDriverException ex)
            {
                return ApiBadRequest("runtime.connection.invalid", ex.Message);
            }
            catch (Exception ex)
            {
                return ApiBadRequest("runtime.connection.create_failed", ex.Message);
            }
        });

        app.MapGet("/api/runtime/connections", (ConnectionManager manager) =>
            Results.Ok(manager.List()));

        app.MapPost("/api/runtime/connections/{id}/disconnect", async (
            string id,
            ConnectionManager manager,
            LogPipeline logs,
            CancellationToken cancellationToken) =>
        {
            if (string.IsNullOrWhiteSpace(id))
            {
                return ApiBadRequest("runtime.connection.id_required", "Connection id is required.");
            }

            PlcConnectionConfig connection;
            try
            {
                connection = manager.Get(id);
            }
            catch (PlcDriverException ex)
            {
                return ApiNotFound("runtime.connection.not_found", ex.Message);
            }

            await manager.DisconnectAndRemoveAsync(id, cancellationToken);
            logs.AddLog("info", "connection_disconnected", id, $"Disconnected by client request. Driver={connection.DriverKey}");
            return Results.Ok(new { id, status = "disconnected" });
        });

        app.MapPost("/api/runtime/connections/{id}/read", async (
            string id,
            RuntimeReadRequest request,
            ConnectionManager manager,
            PlcReadExecutor executor,
            LogPipeline logs,
            CancellationToken cancellationToken) =>
        {
            if (request.Items is null || request.Items.Count == 0)
            {
                return ApiBadRequest("runtime.read.items_required", "At least one read item is required.");
            }

            try
            {
                var connection = manager.Get(id);
                var adapter = manager.GetAdapter(connection.DriverKey);
                var items = request.Items.Select(item => new ReadItemRequest(item.TagId, item.Address, item.DataType, item.RwMode)).ToList();
                logs.AddLog("info", "driver_read_start", id, $"Items={items.Count}");
                var response = await executor.ExecuteAsync(connection, adapter, items, cancellationToken);
                logs.AddLog("info", "driver_read_done", id, $"Packs={response.Stats.PackCount};DriverRequests={response.Stats.DriverRequestCount};CacheHit={response.Stats.CacheHit}");
                return Results.Ok(response);
            }
            catch (PlcDriverException ex) when (ex.Message.Contains("not found", StringComparison.OrdinalIgnoreCase))
            {
                logs.AddLog("error", "read_failed", id, ex.Message);
                return ApiNotFound("runtime.connection.not_found", ex.Message);
            }
            catch (PlcDriverException ex)
            {
                logs.AddLog("error", "driver_read_failed", id, ex.Message);
                return ApiBadRequest("runtime.read.invalid", ex.Message);
            }
            catch (Exception ex)
            {
                logs.AddLog("error", "driver_read_failed", id, ex.Message);
                return ApiBadRequest("runtime.read.failed", ex.Message);
            }
        });

        app.MapPost("/api/runtime/connections/{id}/write", async (
            string id,
            RuntimeWriteRequest request,
            ConnectionManager manager,
            LogPipeline logs,
            CancellationToken cancellationToken) =>
        {
            try
            {
                var connection = manager.Get(id);
                var adapter = manager.GetAdapter(connection.DriverKey);
                logs.AddLog("info", "driver_write_start", id, $"Address={request.Address};Count={request.Values.Count}");
                var response = await adapter.WriteAsync(connection, new PlcWriteRequest(request.Address, request.DataType, request.Values), cancellationToken);
                logs.AddLog(response.Success ? "info" : "warn", "driver_write_done", id, response.Success ? "ok" : response.Error ?? "failed");
                return response.Success ? Results.Ok(response) : ApiBadRequest("runtime.write.failed", response.Error ?? "Write failed.");
            }
            catch (PlcDriverException ex) when (ex.Message.Contains("not found", StringComparison.OrdinalIgnoreCase))
            {
                logs.AddLog("error", "write_failed", id, ex.Message);
                return ApiNotFound("runtime.connection.not_found", ex.Message);
            }
            catch (PlcDriverException ex)
            {
                logs.AddLog("error", "write_failed", id, ex.Message);
                return ApiBadRequest("runtime.write.invalid", ex.Message);
            }
            catch (Exception ex)
            {
                logs.AddLog("error", "write_failed", id, ex.Message);
                return ApiBadRequest("runtime.write.failed", ex.Message);
            }
        });
    }

    private static IResult ApiBadRequest(string code, string message, object? details = null)
    {
        return Results.Json(new ApiErrorResponse(code, message, details), statusCode: StatusCodes.Status400BadRequest);
    }

    private static IResult ApiNotFound(string code, string message, object? details = null)
    {
        return Results.Json(new ApiErrorResponse(code, message, details), statusCode: StatusCodes.Status404NotFound);
    }
}
