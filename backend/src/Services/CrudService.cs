using Backend.Data;
using Backend.Models;
using Microsoft.Data.Sqlite;

namespace Backend.Services;

public sealed class CrudService
{
    private readonly Database _database;

    public CrudService(Database database)
    {
        _database = database;
    }

    public IReadOnlyList<ConnectionModel> GetConnections()
    {
        using var connection = _database.OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = @"
            SELECT id, name, protocol, driver_key, endpoint_json, status, created_at, updated_at
            FROM connections
            ORDER BY created_at DESC;";

        using var reader = command.ExecuteReader();
        var results = new List<ConnectionModel>();
        while (reader.Read())
        {
            results.Add(new ConnectionModel(
                reader.GetString(0),
                reader.GetString(1),
                reader.GetString(2),
                reader.GetString(3),
                reader.GetString(4),
                reader.GetString(5),
                reader.GetString(6),
                reader.GetString(7)));
        }

        return results;
    }

    public ConnectionModel CreateConnection(CreateConnectionRequest request)
    {
        var now = DateTime.UtcNow.ToString("O");
        var model = new ConnectionModel(
            request.Id ?? $"conn-{Guid.NewGuid():N}",
            request.Name,
            request.Protocol,
            request.DriverKey,
            request.EndpointJson,
            request.Status ?? "disconnected",
            now,
            now);

        using var connection = _database.OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = @"
            INSERT INTO connections(id, name, protocol, driver_key, endpoint_json, status, created_at, updated_at)
            VALUES ($id, $name, $protocol, $driver_key, $endpoint_json, $status, $created_at, $updated_at);";
        command.Parameters.AddWithValue("$id", model.Id);
        command.Parameters.AddWithValue("$name", model.Name);
        command.Parameters.AddWithValue("$protocol", model.Protocol);
        command.Parameters.AddWithValue("$driver_key", model.DriverKey);
        command.Parameters.AddWithValue("$endpoint_json", model.EndpointJson);
        command.Parameters.AddWithValue("$status", model.Status);
        command.Parameters.AddWithValue("$created_at", model.CreatedAt);
        command.Parameters.AddWithValue("$updated_at", model.UpdatedAt);
        command.ExecuteNonQuery();

        return model;
    }

    public bool UpdateConnection(string id, UpdateConnectionRequest request)
    {
        var now = DateTime.UtcNow.ToString("O");
        using var connection = _database.OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = @"
            UPDATE connections
            SET name = $name,
                protocol = $protocol,
                driver_key = $driver_key,
                endpoint_json = $endpoint_json,
                status = $status,
                updated_at = $updated_at
            WHERE id = $id;";
        command.Parameters.AddWithValue("$id", id);
        command.Parameters.AddWithValue("$name", request.Name);
        command.Parameters.AddWithValue("$protocol", request.Protocol);
        command.Parameters.AddWithValue("$driver_key", request.DriverKey);
        command.Parameters.AddWithValue("$endpoint_json", request.EndpointJson);
        command.Parameters.AddWithValue("$status", request.Status);
        command.Parameters.AddWithValue("$updated_at", now);
        return command.ExecuteNonQuery() > 0;
    }

    public bool DeleteConnection(string id)
    {
        using var connection = _database.OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = "DELETE FROM connections WHERE id = $id;";
        command.Parameters.AddWithValue("$id", id);
        return command.ExecuteNonQuery() > 0;
    }
}

public sealed record CreateConnectionRequest(string? Id, string Name, string Protocol, string DriverKey, string EndpointJson, string? Status);
public sealed record UpdateConnectionRequest(string Name, string Protocol, string DriverKey, string EndpointJson, string Status);
