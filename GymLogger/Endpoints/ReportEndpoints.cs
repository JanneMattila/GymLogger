using GymLogger.Extensions;
using GymLogger.Repositories;
using GymLogger.Services;
using System.Security.Claims;

namespace GymLogger.Endpoints;

public static class ReportEndpoints
{
    public static void MapReportEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/users/me/reports");

        // Generate report for date range (supports PDF and CSV formats)
        group.MapGet("/workout", async (
            ClaimsPrincipal user,
            string startDate,
            string endDate,
            string? format,
            SessionRepository sessionRepo,
            ExerciseRepository exerciseRepo,
            ReportService reportService) =>
        {
            if (string.IsNullOrWhiteSpace(startDate) || string.IsNullOrWhiteSpace(endDate))
            {
                return Results.BadRequest(new { error = "startDate and endDate are required" });
            }

            // Default to PDF if format not specified
            var reportFormat = format?.ToLowerInvariant() ?? "pdf";
            if (reportFormat != "pdf" && reportFormat != "csv")
            {
                return Results.BadRequest(new { error = "Invalid format. Supported formats: pdf, csv" });
            }

            // Get sessions for the date range
            var sessions = await sessionRepo.GetSessionsAsync(user.Id, startDate, endDate);
            if (sessions == null || sessions.Count == 0)
            {
                return Results.NotFound(new { error = "No sessions found for the specified date range" });
            }

            // Get sets for all sessions
            var setsBySession = new Dictionary<string, List<GymLogger.Models.WorkoutSet>>();
            var allExerciseIds = new HashSet<string>();

            foreach (var session in sessions)
            {
                var sets = await sessionRepo.GetSetsForSessionAsync(user.Id, session.Id);
                setsBySession[session.Id] = sets;

                foreach (var set in sets)
                {
                    if (!string.IsNullOrWhiteSpace(set.ExerciseId))
                    {
                        allExerciseIds.Add(set.ExerciseId);
                    }
                }
            }

            // Get exercise details
            var exercises = await exerciseRepo.GetExercisesByIdsAsync(user.Id, allExerciseIds.ToList());
            var exerciseLookup = exercises.ToDictionary(e => e.Id, e => e);

            // Generate report
            var (data, contentType, extension) = reportService.GenerateWorkoutReport(
                startDate,
                endDate,
                sessions,
                setsBySession,
                exerciseLookup,
                reportFormat);

            var fileName = $"workout-report-{startDate}-to-{endDate}.{extension}";

            return Results.File(
                data,
                contentType: contentType,
                fileDownloadName: fileName);
        });
    }
}
