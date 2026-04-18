using Microsoft.Data.Sqlite;

namespace Backend.Data;

public sealed class MigrationRunner
{
    private readonly Database _database;

    public MigrationRunner(Database database)
    {
        _database = database;
    }

    public void Run()
    {
        using var connection = _database.OpenConnection();
        EnsureSchemaMigrationsTable(connection);

        var migrations = GetMigrations();
        foreach (var migration in migrations)
        {
            if (MigrationApplied(connection, migration.Version))
            {
                continue;
            }

            using var tx = connection.BeginTransaction();
            using var command = connection.CreateCommand();
            command.Transaction = tx;
            command.CommandText = migration.Sql;
            command.ExecuteNonQuery();

            using var insert = connection.CreateCommand();
            insert.Transaction = tx;
            insert.CommandText = "INSERT INTO schema_migrations(version, applied_at) VALUES ($version, datetime('now'));";
            insert.Parameters.AddWithValue("$version", migration.Version);
            insert.ExecuteNonQuery();

            tx.Commit();
        }
    }

    private static void EnsureSchemaMigrationsTable(SqliteConnection connection)
    {
        using var command = connection.CreateCommand();
        command.CommandText = @"
            CREATE TABLE IF NOT EXISTS schema_migrations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                version TEXT NOT NULL UNIQUE,
                applied_at TEXT NOT NULL
            );";
        command.ExecuteNonQuery();
    }

    private static bool MigrationApplied(SqliteConnection connection, string version)
    {
        using var command = connection.CreateCommand();
        command.CommandText = "SELECT COUNT(1) FROM schema_migrations WHERE version = $version;";
        command.Parameters.AddWithValue("$version", version);
        var count = Convert.ToInt32(command.ExecuteScalar());
        return count > 0;
    }

    private static IReadOnlyList<MigrationDefinition> GetMigrations()
    {
        return new List<MigrationDefinition>
        {
            new(
                "20260417_01_init",
                @"
                CREATE TABLE IF NOT EXISTS connections (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    protocol TEXT NOT NULL,
                    driver_key TEXT NOT NULL,
                    endpoint_json TEXT NOT NULL,
                    status TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                "),
            new(
                "20260417_02_seed",
                @"
                INSERT OR IGNORE INTO connections (id, name, protocol, driver_key, endpoint_json, status, created_at, updated_at)
                VALUES (
                    'conn-demo-modbus-tcp',
                    'Demo Modbus TCP',
                    'modbus-tcp',
                    'fluentmodbus',
                    '{""host"":""127.0.0.1"",""port"":502,""unitId"":1}',
                    'disconnected',
                    datetime('now'),
                    datetime('now')
                );
                "),
        };
    }
}

public sealed record MigrationDefinition(string Version, string Sql);
