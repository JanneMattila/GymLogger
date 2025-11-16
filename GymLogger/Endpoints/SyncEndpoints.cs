namespace GymLogger.Endpoints;

public static class SyncEndpoints
{
    public static void MapSyncEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/sync");

        // Sync endpoint (placeholder for offline sync)
        group.MapPost("/", async (SyncRequest syncRequest) =>
        {
            // TODO: Implement batch sync with conflict resolution
            return Results.Ok(new { success = true, conflicts = new List<object>() });
        });
    }

    // DTO for sync endpoint
    public record SyncRequest(List<SyncOperation> Operations);
    public record SyncOperation(string Type, string Entity, string Id, object Data);
}
