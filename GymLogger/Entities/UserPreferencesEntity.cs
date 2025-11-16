using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace GymLogger.Entities;

[Table("UserPreferences")]
public class UserPreferencesEntity
{
    [Key]
    [MaxLength(36)]
    public string Id { get; set; } = Guid.NewGuid().ToString();

    [Required]
    [MaxLength(36)]
    public string UserId { get; set; } = string.Empty;

    [Required]
    [MaxLength(10)]
    public string DefaultWeightUnit { get; set; } = "KG";

    [Required]
    public int WeekStartDay { get; set; } = 0; // 0-6

    [Required]
    [MaxLength(20)]
    public string Theme { get; set; } = "auto";

    [Required]
    [MaxLength(100)]
    public string WarmupPercentages { get; set; } = "[50,60,70,80,90]"; // JSON array

    [Required]
    [MaxLength(100)]
    public string WarmupReps { get; set; } = "[5,5,3,2,1]"; // JSON array

    [Required]
    [MaxLength(100)]
    public string WarmupSets { get; set; } = "[2,1,1,1,1]"; // JSON array

    [Required]
    [MaxLength(20)]
    public string WarmupBehavior { get; set; } = "ask"; // ask, auto, never

    [Required]
    [MaxLength(20)]
    public string WarmupPreset { get; set; } = "standard"; // standard, quick, custom

    [Required]
    public int DefaultRestSeconds { get; set; } = 90;

    public bool SoundEnabled { get; set; } = true;

    [Required]
    public int RestTimerDuration { get; set; } = 90;

    public bool EnableNotifications { get; set; } = true;

    public bool OutboundIntegrationEnabled { get; set; } = false;

    [MaxLength(500)]
    public string? OutboundIntegrationUrl { get; set; }

    public bool InboundIntegrationEnabled { get; set; } = false;

    [MaxLength(100)]
    public string? InboundIntegrationKey { get; set; }

    [Required]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAt { get; set; }

    // Navigation property
    [ForeignKey(nameof(UserId))]
    public virtual UserEntity User { get; set; } = null!;
}
