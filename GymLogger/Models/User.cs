using System.Text.Json.Serialization;

namespace GymLogger.Models;

public class User
{
    /// <summary>
    /// Internal application user ID (GUID)
    /// </summary>
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;
    
    /// <summary>
    /// External identity (Azure AD oid or guest session ID)
    /// </summary>
    [JsonPropertyName("externalId")]
    public string ExternalId { get; set; } = string.Empty;
    
    /// <summary>
    /// Type of authentication: "EntraID" or "Guest"
    /// </summary>
    [JsonPropertyName("authType")]
    public string AuthType { get; set; } = string.Empty;
    
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;
    
    [JsonPropertyName("isAdmin")]
    public bool IsAdmin { get; set; }
    
    [JsonPropertyName("createdAt")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    [JsonPropertyName("updatedAt")]
    public DateTime? UpdatedAt { get; set; }
}
