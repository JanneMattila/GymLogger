using System.Text.Json.Serialization;

namespace GymLogger.Models;

/// <summary>
/// Represents the advancement level for a specific muscle group.
/// Levels are calculated based on lifting statistics relative to body weight, age, and gender.
/// </summary>
public class MuscleAdvancement
{
    [JsonPropertyName("muscleGroup")]
    public string MuscleGroup { get; set; } = string.Empty;
    
    /// <summary>
    /// Level from 1-5:
    /// 1 = Beginner (just started, no significant progress)
    /// 2 = Novice (some progress, developing foundation)
    /// 3 = Intermediate (consistent training, good progress)
    /// 4 = Advanced (significant strength gains)
    /// 5 = Elite (exceptional strength, top percentile)
    /// </summary>
    [JsonPropertyName("level")]
    public int Level { get; set; }
    
    [JsonPropertyName("levelName")]
    public string LevelName { get; set; } = string.Empty;
    
    /// <summary>
    /// Best estimated 1RM for exercises in this muscle group (in kg)
    /// </summary>
    [JsonPropertyName("best1RM")]
    public decimal? Best1RM { get; set; }
    
    /// <summary>
    /// Name of the exercise that achieved the best 1RM
    /// </summary>
    [JsonPropertyName("bestExerciseName")]
    public string? BestExerciseName { get; set; }
    
    /// <summary>
    /// Ratio of best 1RM to body weight (if body weight is provided)
    /// </summary>
    [JsonPropertyName("strengthRatio")]
    public decimal? StrengthRatio { get; set; }
    
    /// <summary>
    /// Number of exercises tracked in this muscle group
    /// </summary>
    [JsonPropertyName("exerciseCount")]
    public int ExerciseCount { get; set; }
    
    /// <summary>
    /// Total number of sets logged for this muscle group
    /// </summary>
    [JsonPropertyName("totalSetsLogged")]
    public int TotalSetsLogged { get; set; }
}

/// <summary>
/// Response containing all muscle group advancements for body map visualization
/// </summary>
public class BodyMapResponse
{
    [JsonPropertyName("muscleAdvancements")]
    public List<MuscleAdvancement> MuscleAdvancements { get; set; } = new();
    
    /// <summary>
    /// Whether body metrics are configured (affects accuracy of advancement calculations)
    /// </summary>
    [JsonPropertyName("hasBodyMetrics")]
    public bool HasBodyMetrics { get; set; }
    
    /// <summary>
    /// User's body weight if configured (in kg)
    /// </summary>
    [JsonPropertyName("bodyWeight")]
    public decimal? BodyWeight { get; set; }
    
    /// <summary>
    /// User's gender if configured
    /// </summary>
    [JsonPropertyName("gender")]
    public string? Gender { get; set; }
    
    /// <summary>
    /// User's age if configured
    /// </summary>
    [JsonPropertyName("age")]
    public int? Age { get; set; }
}

/// <summary>
/// Static class for advancement level names and colors
/// </summary>
public static class AdvancementLevels
{
    public const int NoData = 0;
    public const int Beginner = 1;
    public const int Novice = 2;
    public const int Intermediate = 3;
    public const int Advanced = 4;
    public const int Elite = 5;
    
    public static string GetLevelName(int level) => level switch
    {
        0 => "No Data",
        1 => "Beginner",
        2 => "Novice",
        3 => "Intermediate",
        4 => "Advanced",
        5 => "Elite",
        _ => "Unknown"
    };
}
