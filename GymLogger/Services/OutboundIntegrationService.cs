using System.Net.Http;
using System.Text;
using System.Text.Json;
using GymLogger.Models;

namespace GymLogger.Services;

public class OutboundIntegrationService
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<OutboundIntegrationService> _logger;

    public OutboundIntegrationService(
        IHttpClientFactory httpClientFactory,
        ILogger<OutboundIntegrationService> logger)
    {
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    public async Task<(bool Success, string? Error)> SendWorkoutDataAsync(
        string integrationUrl,
        WorkoutSession session,
        List<WorkoutSet> sets,
        Dictionary<string, Exercise> exerciseLookup)
    {
        if (string.IsNullOrWhiteSpace(integrationUrl))
        {
            return (false, "No integration URL configured");
        }

        try
        {
            // Transform workout data to match the integration schema
            var integrationData = sets
                .Where(s => !s.IsWarmup) // Only send working sets
                .Select((set, index) =>
                {
                    var exercise = exerciseLookup.GetValueOrDefault(set.ExerciseId);
                    var exerciseName = exercise?.Name ?? "Unknown Exercise";
                    var muscleGroup = exercise?.MuscleGroup ?? "N/A";
                    var equipmentType = exercise?.EquipmentType ?? "N/A";
                    
                    // Calculate set number for this exercise
                    var exerciseSets = sets
                        .Where(s => s.ExerciseId == set.ExerciseId && !s.IsWarmup)
                        .OrderBy(s => s.SetNumber)
                        .ToList();
                    var setNumber = exerciseSets.IndexOf(set) + 1;
                    var totalSets = exerciseSets.Count;

                    return new
                    {
                        date = session.SessionDate,
                        qty = set.Reps ?? 0,
                        weight = (int)Math.Round(set.Weight ?? 0),
                        title = exerciseName,
                        description = $"{muscleGroup} - {equipmentType} - Working set {setNumber} of {totalSets}"
                    };
                })
                .ToList();

            if (integrationData.Count == 0)
            {
                return (false, "No working sets to send");
            }

            var jsonContent = JsonSerializer.Serialize(integrationData, new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            });

            _logger.LogInformation("Sending workout data to integration endpoint: {Url}", integrationUrl);
            _logger.LogDebug("Integration payload: {Payload}", jsonContent);

            var httpClient = _httpClientFactory.CreateClient();
            httpClient.Timeout = TimeSpan.FromSeconds(30);

            var content = new StringContent(jsonContent);
            content.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("application/json");
            var response = await httpClient.PostAsync(integrationUrl, content);

            if (response.IsSuccessStatusCode)
            {
                _logger.LogInformation("Successfully sent workout data to integration endpoint");
                return (true, null);
            }
            else
            {
                var errorBody = await response.Content.ReadAsStringAsync();
                var errorMessage = $"Integration endpoint returned {(int)response.StatusCode}: {response.ReasonPhrase}";
                _logger.LogWarning("Failed to send workout data: {Error}. Response: {Response}", 
                    errorMessage, errorBody);
                return (false, errorMessage);
            }
        }
        catch (HttpRequestException ex)
        {
            var errorMessage = $"Network error: {ex.Message}";
            _logger.LogError(ex, "HTTP request failed when sending workout data");
            return (false, errorMessage);
        }
        catch (TaskCanceledException ex)
        {
            var errorMessage = "Request timeout - integration endpoint did not respond in time";
            _logger.LogError(ex, "Request timeout when sending workout data");
            return (false, errorMessage);
        }
        catch (Exception ex)
        {
            var errorMessage = $"Unexpected error: {ex.Message}";
            _logger.LogError(ex, "Unexpected error when sending workout data");
            return (false, errorMessage);
        }
    }
}
