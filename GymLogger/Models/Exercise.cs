using System.Text.Json.Serialization;

namespace GymLogger.Models;

public class Exercise
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = Guid.NewGuid().ToString();
    
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;
    
    [JsonPropertyName("muscleGroup")]
    public string? MuscleGroup { get; set; }
    
    [JsonPropertyName("equipmentType")]
    public string? EquipmentType { get; set; }
    
    [JsonPropertyName("description")]
    public string? Description { get; set; }
    
    [JsonPropertyName("isCustom")]
    public bool IsCustom { get; set; }
    
    [JsonPropertyName("userId")]
    public string? UserId { get; set; }
    
    [JsonPropertyName("createdAt")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    [JsonPropertyName("updatedAt")]
    public DateTime? UpdatedAt { get; set; }
}
