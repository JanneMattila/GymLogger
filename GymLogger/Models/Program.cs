using System.Text.Json.Serialization;

namespace GymLogger.Models;

public class Program
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = Guid.NewGuid().ToString();
    
    [JsonPropertyName("userId")]
    public string UserId { get; set; } = string.Empty;
    
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;
    
    [JsonPropertyName("dayOfWeek")]
    public int? DayOfWeek { get; set; }
    
    [JsonPropertyName("isDefault")]
    public bool IsDefault { get; set; }
    
    [JsonPropertyName("lastUsedDate")]
    public DateTime? LastUsedDate { get; set; }
    
    [JsonPropertyName("exercises")]
    public List<ProgramExercise> Exercises { get; set; } = new();
    
    [JsonPropertyName("createdAt")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    [JsonPropertyName("updatedAt")]
    public DateTime? UpdatedAt { get; set; }
}

public class ProgramExercise
{
    [JsonPropertyName("exerciseId")]
    public string ExerciseId { get; set; } = string.Empty;
    
    [JsonPropertyName("exerciseName")]
    public string ExerciseName { get; set; } = string.Empty;
    
    [JsonPropertyName("order")]
    public int Order { get; set; }
    
    [JsonPropertyName("sets")]
    public int Sets { get; set; }
    
    [JsonPropertyName("repsMin")]
    public int RepsMin { get; set; }
    
    [JsonPropertyName("repsMax")]
    public int RepsMax { get; set; }
    
    [JsonPropertyName("targetWeight")]
    public decimal? TargetWeight { get; set; }
    
    [JsonPropertyName("restSeconds")]
    public int? RestSeconds { get; set; }
    
    [JsonPropertyName("notes")]
    public string? Notes { get; set; }
}
