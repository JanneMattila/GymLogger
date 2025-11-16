using GymLogger.Extensions;
using GymLogger.Models;
using GymLogger.Repositories;
using System.Security.Claims;

namespace GymLogger.Endpoints;

public static class SessionEndpoints
{
    public static void MapSessionEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/users/me/sessions");

        // Session endpoints
        group.MapGet("/active", async (ClaimsPrincipal user, SessionRepository repo) =>
        {
            return await repo.GetActiveSessionAsync(user.Id);
        });

        group.MapGet("/last-for-program/{programId}", async (ClaimsPrincipal user, string programId, SessionRepository repo) =>
        {
            var session = await repo.GetLastSessionForProgramAsync(user.Id, programId);
            if (session == null) return Results.NotFound();
            
            var sets = await repo.GetSetsForSessionAsync(user.Id, session.Id);
            return Results.Ok(new { session, sets = sets.Where(s => !s.IsWarmup).ToList() });
        });

        group.MapGet("/", async (ClaimsPrincipal user, string? startDate, string? endDate, SessionRepository repo) =>
        {
            return await repo.GetSessionsAsync(user.Id, startDate, endDate);
        });

        group.MapGet("/{id}", async (ClaimsPrincipal user, string id, SessionRepository repo) =>
        {
            var session = await repo.GetSessionByIdAsync(user.Id, id);
            if (session == null) return Results.NotFound();
            
            var sets = await repo.GetSetsForSessionAsync(user.Id, id);
            return Results.Ok(new { session, sets });
        });

        group.MapPost("/", async (ClaimsPrincipal user, WorkoutSession session, SessionRepository repo) =>
        {
            return await repo.CreateSessionAsync(user.Id, session);
        });

        group.MapPut("/{id}", async (ClaimsPrincipal user, string id, WorkoutSession session, SessionRepository repo) =>
        {
            var updated = await repo.UpdateSessionAsync(user.Id, id, session);
            return updated != null ? Results.Ok(updated) : Results.NotFound();
        });

        group.MapPost("/{id}/cleanup", async (ClaimsPrincipal user, string id, SessionRepository repo) =>
        {
            var result = await repo.CleanupSessionAsync(user.Id, id);
            return result ? Results.Ok() : Results.NotFound();
        });

        // Set endpoints (part of sessions)
        group.MapGet("/{sessionId}/sets", async (ClaimsPrincipal user, string sessionId, SessionRepository repo) =>
        {
            return await repo.GetSetsForSessionAsync(user.Id, sessionId);
        });

        group.MapPost("/{sessionId}/sets", async (ClaimsPrincipal user, string sessionId, WorkoutSet set, SessionRepository repo) =>
        {
            return await repo.AddSetAsync(user.Id, sessionId, set);
        });

        group.MapPut("/{sessionId}/sets/{setId}", async (ClaimsPrincipal user, string sessionId, string setId, WorkoutSet set, SessionRepository repo) =>
        {
            var updated = await repo.UpdateSetAsync(user.Id, sessionId, setId, set);
            return updated != null ? Results.Ok(updated) : Results.NotFound();
        });

        group.MapDelete("/{sessionId}/sets/{setId}", async (ClaimsPrincipal user, string sessionId, string setId, SessionRepository repo) =>
        {
            await repo.DeleteSetAsync(user.Id, sessionId, setId);
            return Results.Ok();
        });
    }
}
