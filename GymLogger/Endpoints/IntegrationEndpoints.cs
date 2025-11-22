using GymLogger.Extensions;
using GymLogger.Models;
using GymLogger.Repositories;
using GymLogger.Services;
using System.Security.Claims;

namespace GymLogger.Endpoints;

public static class IntegrationEndpoints
{
    public static void MapIntegrationEndpoints(this IEndpointRouteBuilder app)
    {
        var outboundGroup = app.MapGroup("/api/users/me/sessions");

        // Outbound integration endpoint
        outboundGroup.MapPost("/{sessionId}/submit-integration", async (
            ClaimsPrincipal user,
            string sessionId,
            SessionRepository sessionRepo,
            ExerciseRepository exerciseRepo,
            UserRepository userRepo,
            OutboundIntegrationService integrationService) =>
        {
            // Get user preferences to check for integration URL
            var prefsResponse = await userRepo.GetPreferencesAsync(user.Id);
            var integrationEnabled = prefsResponse?.OutboundIntegrationEnabled ?? false;
            var integrationUrl = prefsResponse?.OutboundIntegrationUrl;
            
            if (!integrationEnabled || string.IsNullOrWhiteSpace(integrationUrl))
            {
                return Results.BadRequest(new { error = "Outbound integration is not enabled or configured" });
            }
            
            // Get session and sets
            var session = await sessionRepo.GetSessionByIdAsync(user.Id, sessionId);
            if (session == null)
            {
                return Results.NotFound(new { error = "Session not found" });
            }
            
            var sets = await sessionRepo.GetSetsForSessionAsync(user.Id, sessionId);
            
            // Get exercise details for mapping (only fetch the ones used in this session)
            var exerciseIds = sets
                .Select(s => s.ExerciseId)
                .Where(id => !string.IsNullOrWhiteSpace(id))
                .Distinct()
                .ToList();

            var exercises = await exerciseRepo.GetExercisesByIdsAsync(user.Id, exerciseIds);
            var exerciseLookup = exercises.ToDictionary(e => e.Id, e => e);

            // Send data to integration endpoint
            (bool success, string? error) = await integrationService.SendWorkoutDataAsync(
                integrationUrl,
                session,
                sets,
                exerciseLookup);
            
            if (success)
            {
                return Results.Ok(new { success = true, message = "Workout data submitted successfully" });
            }
            else
            {
                return Results.BadRequest(new { success = false, error });
            }
        });

        // Inbound integration endpoint (public, authenticated via API key - not using cookie auth)
        var importGroup = app.MapGroup("/api/import")
            .AllowAnonymous();

        importGroup.MapPost("/", async (
            HttpContext httpContext,
            string? key,
            List<ImportWorkoutData> data,
            UserRepository userRepo,
            SessionRepository sessionRepo,
            ExerciseRepository exerciseRepo) =>
        {
            if (string.IsNullOrWhiteSpace(key))
            {
                return Results.BadRequest(new { error = "API key is required" });
            }

            // Find user by API key
            var allUsers = await userRepo.GetAllUsersWithPreferencesAsync();
            var userTuple = allUsers.FirstOrDefault(tuple => 
                tuple.Preferences?.InboundIntegrationEnabled == true && 
                tuple.Preferences?.InboundIntegrationKey == key);

            if (userTuple.User == null)
            {
                return Results.Unauthorized();
            }

            var userId = userTuple.User.Id;

            if (data == null || data.Count == 0)
            {
                return Results.BadRequest(new { error = "No workout data provided" });
            }

            try
            {
                // Create a new session for imported data
                var session = new WorkoutSession
                {
                    ProgramName = "Imported Workout",
                    SessionDate = data[0].Date,
                    Status = "completed",
                    CompletedAt = DateTime.UtcNow
                };

                var sessionResponse = await sessionRepo.CreateSessionAsync(userId, session);
                
                // Get or create exercises
                var exercises = await exerciseRepo.GetAllExercisesAsync(userId);
                var exerciseLookup = exercises.ToDictionary(e => e.Name, e => e.Id, StringComparer.OrdinalIgnoreCase);

                // Import sets
                int setNumber = 1;
                foreach (var item in data)
                {
                    // Find or create exercise
                    if (!exerciseLookup.TryGetValue(item.Title, out var exerciseId))
                    {
                        // Create new exercise
                        var newExercise = new Exercise
                        {
                            Name = item.Title,
                            Description = item.Description,
                            MuscleGroup = "Unknown",
                            EquipmentType = "Unknown"
                        };
                        var exerciseResponse = await exerciseRepo.CreateUserExerciseAsync(userId, newExercise);
                        exerciseId = exerciseResponse.Id;
                        exerciseLookup[item.Title] = exerciseId;
                    }

                    // Create set
                    var set = new WorkoutSet
                    {
                        ExerciseId = exerciseId,
                        SetNumber = setNumber++,
                        Weight = item.Weight,
                        Reps = item.Qty,
                        IsWarmup = false,
                        LoggedAt = DateTime.UtcNow
                    };

                    await sessionRepo.AddSetAsync(userId, sessionResponse.Id, set);
                }

                return Results.Ok(new { success = true, sessionId = sessionResponse.Id, setsImported = data.Count });
            }
            catch (Exception ex)
            {
                return Results.BadRequest(new { error = $"Import failed: {ex.Message}" });
            }
        });
    }

    // DTO for import endpoint
    public record ImportWorkoutData(
        string Date,
        int Qty,
        decimal Weight,
        string Title,
        string Description
    );
}
