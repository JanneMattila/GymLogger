using System.Text.Json.Serialization;

namespace GymLogger.Models;

public class WorkoutSet
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = Guid.NewGuid().ToString();
    
    [JsonPropertyName("sessionId")]
    public string SessionId { get; set; } = string.Empty;
    
    [JsonPropertyName("programId")]
    public string? ProgramId { get; set; }
    
    [JsonPropertyName("programExerciseId")]
    public string? ProgramExerciseId { get; set; }
    
    [JsonPropertyName("exerciseId")]
    public string ExerciseId { get; set; } = string.Empty;
    
    [JsonPropertyName("exerciseName")]
    public string ExerciseName { get; set; } = string.Empty;
    
    [JsonPropertyName("setNumber")]
    public int SetNumber { get; set; }
    
    [JsonPropertyName("reps")]
    public int? Reps { get; set; }
    
    [JsonPropertyName("weight")]
    public decimal? Weight { get; set; }
    
    [JsonPropertyName("weightUnit")]
    public string WeightUnit { get; set; } = "KG";
    
    [JsonPropertyName("isWarmup")]
    public bool IsWarmup { get; set; }
    
    [JsonPropertyName("restSeconds")]
    public int? RestSeconds { get; set; }
    
    [JsonPropertyName("notes")]
    public string? Notes { get; set; }
    
    [JsonPropertyName("loggedAt")]
    public DateTime LoggedAt { get; set; } = DateTime.UtcNow;
    
    [JsonPropertyName("createdAt")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    [JsonPropertyName("updatedAt")]
    public DateTime? UpdatedAt { get; set; }
}
