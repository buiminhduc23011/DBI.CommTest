namespace Backend.Models;

public sealed record ConnectionModel(
    string Id,
    string Name,
    string Protocol,
    string DriverKey,
    string EndpointJson,
    string Status,
    string CreatedAt,
    string UpdatedAt);
