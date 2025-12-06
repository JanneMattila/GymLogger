using System.Text.Json.Serialization;

namespace GymLogger.Models;

public class UserPreferences
{
    [JsonPropertyName("userId")]
    public string UserId { get; set; } = string.Empty;
    
    [JsonPropertyName("warmupPercentages")]
    public int[] WarmupPercentages { get; set; } = [50, 60, 70, 80, 90];
    
    [JsonPropertyName("warmupReps")]
    public int[] WarmupReps { get; set; } = [5, 5, 3, 2, 1];
    
    [JsonPropertyName("warmupSets")]
    public int[] WarmupSets { get; set; } = [2, 1, 1, 1, 1];
    
    [JsonPropertyName("warmupBehavior")]
    public string WarmupBehavior { get; set; } = "per-exercise";
    
    [JsonPropertyName("warmupPreset")]
    public string WarmupPreset { get; set; } = "standard";
    
    [JsonPropertyName("defaultWeightUnit")]
    public string DefaultWeightUnit { get; set; } = "KG";
    
    [JsonPropertyName("defaultRestSeconds")]
    public int DefaultRestSeconds { get; set; } = 90;
    
    [JsonPropertyName("enableNotifications")]
    public bool EnableNotifications { get; set; } = true;
    
    [JsonPropertyName("soundEnabled")]
    public bool SoundEnabled { get; set; } = true;
    
    [JsonPropertyName("keepScreenAwake")]
    public bool KeepScreenAwake { get; set; } = false;

    [JsonPropertyName("restTimerDuration")]
    public int RestTimerDuration { get; set; } = 90;
    
    [JsonPropertyName("theme")]
    public string Theme { get; set; } = "system";
    
    [JsonPropertyName("weekStartDay")]
    public int WeekStartDay { get; set; } = 1; // 0 = Sunday, 1 = Monday, etc.
    
    [JsonPropertyName("outboundIntegrationEnabled")]
    public bool OutboundIntegrationEnabled { get; set; } = false;
    
    [JsonPropertyName("outboundIntegrationUrl")]
    public string? OutboundIntegrationUrl { get; set; }
    
    [JsonPropertyName("inboundIntegrationEnabled")]
    public bool InboundIntegrationEnabled { get; set; } = false;
    
    [JsonPropertyName("inboundIntegrationKey")]
    public string? InboundIntegrationKey { get; set; }
    
    // Body metrics for progress analysis (optional)
    [JsonPropertyName("bodyWeight")]
    public decimal? BodyWeight { get; set; }
    
    [JsonPropertyName("gender")]
    public string? Gender { get; set; } // Male, Female, Other
    
    [JsonPropertyName("age")]
    public int? Age { get; set; }
    
    [JsonPropertyName("createdAt")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    [JsonPropertyName("updatedAt")]
    public DateTime? UpdatedAt { get; set; }
}
