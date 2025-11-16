using System.Text.Json.Serialization;

namespace GymLogger.Models;

public class ExerciseStats
{
    [JsonPropertyName("exerciseId")]
    public string ExerciseId { get; set; } = string.Empty;
    
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;
    
    [JsonPropertyName("maxWeight")]
    public decimal? MaxWeight { get; set; }
    
    [JsonPropertyName("maxWeightDate")]
    public string? MaxWeightDate { get; set; }
    
    [JsonPropertyName("epley1RM")]
    public decimal? Epley1RM { get; set; }
    
    [JsonPropertyName("epley1RMDate")]
    public string? Epley1RMDate { get; set; }
    
    [JsonPropertyName("brzycki1RM")]
    public decimal? Brzycki1RM { get; set; }
    
    [JsonPropertyName("brzycki1RMDate")]
    public string? Brzycki1RMDate { get; set; }
    
    [JsonPropertyName("maxVolume")]
    public decimal? MaxVolume { get; set; }
    
    [JsonPropertyName("maxVolumeDate")]
    public string? MaxVolumeDate { get; set; }
}

public class HistoryDataPoint
{
    [JsonPropertyName("date")]
    public string Date { get; set; } = string.Empty;
    
    [JsonPropertyName("sets")]
    public List<SetData> Sets { get; set; } = new();
}

public class SetData
{
    [JsonPropertyName("weight")]
    public decimal Weight { get; set; }
    
    [JsonPropertyName("reps")]
    public int Reps { get; set; }
    
    [JsonPropertyName("volume")]
    public decimal Volume { get; set; }
}
