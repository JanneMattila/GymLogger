using System.Text.Json.Serialization;

namespace GymLogger.Models;

public class ProgramTemplate
{
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;
    
    [JsonPropertyName("description")]
    public string Description { get; set; } = string.Empty;
    
    [JsonPropertyName("exercises")]
    public List<TemplateExercise> Exercises { get; set; } = new();
}

public class TemplateExercise
{
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;
    
    [JsonPropertyName("muscleGroup")]
    public string MuscleGroup { get; set; } = string.Empty;
    
    [JsonPropertyName("equipmentType")]
    public string EquipmentType { get; set; } = string.Empty;
    
    [JsonPropertyName("targetSets")]
    public int TargetSets { get; set; }
    
    [JsonPropertyName("targetReps")]
    public string TargetReps { get; set; } = string.Empty;
    
    [JsonPropertyName("restSeconds")]
    public int RestSeconds { get; set; }
}
