using System.Text.Json.Serialization;

namespace GymLogger.Models;

public class WorkoutSession
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = Guid.NewGuid().ToString();
    
    [JsonPropertyName("userId")]
    public string UserId { get; set; } = string.Empty;
    
    [JsonPropertyName("programId")]
    public string? ProgramId { get; set; }
    
    [JsonPropertyName("programName")]
    public string? ProgramName { get; set; }
    
    [JsonPropertyName("sessionDate")]
    public string SessionDate { get; set; } = DateTime.UtcNow.ToString("yyyy-MM-dd");
    
    [JsonPropertyName("startedAt")]
    public DateTime StartedAt { get; set; } = DateTime.UtcNow;
    
    [JsonPropertyName("completedAt")]
    public DateTime? CompletedAt { get; set; }
    
    [JsonPropertyName("status")]
    public string Status { get; set; } = "in-progress";
    
    [JsonPropertyName("sets")]
    public List<WorkoutSet> Sets { get; set; } = new();
    
    [JsonPropertyName("createdAt")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    [JsonPropertyName("updatedAt")]
    public DateTime? UpdatedAt { get; set; }
}
