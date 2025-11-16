using GymLogger.Repositories;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace GymLogger.Controllers;

[ApiController]
[Route("api/[controller]")]
[AllowAnonymous]
public class AuthController : ControllerBase
{
    private readonly UserRepository _userRepository;

    public AuthController(UserRepository userRepository)
    {
        _userRepository = userRepository;
    }

    [HttpGet("login")]
    public IActionResult Login([FromQuery] string? returnUrl = null)
    {
        var redirectUrl = returnUrl ?? "/";
        var properties = new AuthenticationProperties { RedirectUri = redirectUrl };
        return Challenge(properties, OpenIdConnectDefaults.AuthenticationScheme);
    }

    [HttpPost("guest")]
    public async Task<IActionResult> CreateGuestSession()
    {
        var externalId = $"guest-{Guid.NewGuid()}";
        var userName = "Guest User";
        
        // Create or get app user ID
        var appUserId = await _userRepository.GetOrCreateAppUserIdAsync(externalId, "Guest", userName);
        
        var user = await _userRepository.GetUserAsync(appUserId);
        
        // Create claims for guest user
        var claims = new List<Claim>
        {
            new("app_user_id", appUserId)
        };

        var claimsIdentity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
        var claimsPrincipal = new ClaimsPrincipal(claimsIdentity);

        // Sign in with cookie
        await HttpContext.SignInAsync(
            CookieAuthenticationDefaults.AuthenticationScheme,
            claimsPrincipal,
            new AuthenticationProperties
            {
                IsPersistent = true,
                ExpiresUtc = DateTimeOffset.UtcNow.AddDays(180)
            });

        return Ok(new { isGuest = true, userId = appUserId });
    }

    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        var authType = User.FindFirst("authType")?.Value;

        await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);

        if (authType == "EntraID")
        {
            // If Microsoft account user, also sign out from Entra ID
            return SignOut(
                new AuthenticationProperties { RedirectUri = "/" },
                CookieAuthenticationDefaults.AuthenticationScheme,
                OpenIdConnectDefaults.AuthenticationScheme);
        }

        return Ok(new { message = "Logged out successfully" });
    }

    [HttpGet("status")]
    public IActionResult GetStatus()
    {
        if (User.Identity?.IsAuthenticated == true)
        {
            var userId = User.FindFirst("app_user_id")?.Value ?? throw new InvalidOperationException("User ID not found");
            var authType = User.FindFirst("authType")?.Value;
            var isGuest = authType == "Guest";

            return Ok(new
            {
                isAuthenticated = true,
                userId = userId,
                isGuest = isGuest
            });
        }

        return Ok(new { isAuthenticated = false });
    }
}
