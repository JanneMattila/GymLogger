using System.Text.Json.Serialization;

namespace GymLogger.Models;

/// <summary>
/// Root object for the strength-standards.json file
/// </summary>
public class StrengthStandards
{
    [JsonPropertyName("description")]
    public string Description { get; set; } = string.Empty;

    [JsonPropertyName("genders")]
    public List<string> Genders { get; set; } = new();

    [JsonPropertyName("ageGroups")]
    public List<AgeGroup> AgeGroups { get; set; } = new();

    [JsonPropertyName("levels")]
    public List<LevelInfo> Levels { get; set; } = new();

    [JsonPropertyName("muscleGroups")]
    public Dictionary<string, MuscleGroupStandards> MuscleGroups { get; set; } = new();

    [JsonPropertyName("defaultAgeGroup")]
    public string DefaultAgeGroup { get; set; } = "20-30";

    [JsonPropertyName("defaultGender")]
    public string DefaultGender { get; set; } = "Male";

    [JsonPropertyName("notes")]
    public StandardsNotes? Notes { get; set; }
}

public class AgeGroup
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;

    [JsonPropertyName("label")]
    public string Label { get; set; } = string.Empty;

    [JsonPropertyName("minAge")]
    public int? MinAge { get; set; }

    [JsonPropertyName("maxAge")]
    public int? MaxAge { get; set; }
}

public class LevelInfo
{
    [JsonPropertyName("level")]
    public int Level { get; set; }

    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("description")]
    public string Description { get; set; } = string.Empty;
}

public class MuscleGroupStandards
{
    [JsonPropertyName("description")]
    public string Description { get; set; } = string.Empty;

    [JsonPropertyName("primaryExercise")]
    public string PrimaryExercise { get; set; } = string.Empty;

    [JsonPropertyName("standards")]
    public Dictionary<string, Dictionary<string, LevelThresholds>> Standards { get; set; } = new();
}

public class LevelThresholds
{
    [JsonPropertyName("beginner")]
    public decimal Beginner { get; set; }

    [JsonPropertyName("novice")]
    public decimal Novice { get; set; }

    [JsonPropertyName("intermediate")]
    public decimal Intermediate { get; set; }

    [JsonPropertyName("advanced")]
    public decimal Advanced { get; set; }

    [JsonPropertyName("elite")]
    public decimal Elite { get; set; }
}

public class StandardsNotes
{
    [JsonPropertyName("ratioExplanation")]
    public string RatioExplanation { get; set; } = string.Empty;

    [JsonPropertyName("ageAdjustment")]
    public string AgeAdjustment { get; set; } = string.Empty;

    [JsonPropertyName("genderDifference")]
    public string GenderDifference { get; set; } = string.Empty;
}
