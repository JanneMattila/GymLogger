using GymLogger.Models;
using System.Security.Claims;

namespace GymLogger.Extensions;

public static class ClaimsPrincipalExtensions
{
    extension(ClaimsPrincipal source)
    {
        public string Id => source.FindFirst("app_user_id")?.Value ?? throw new InvalidOperationException("User ID not found in claims. User must be authenticated.");
    }
}