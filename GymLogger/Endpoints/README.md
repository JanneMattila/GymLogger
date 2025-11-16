# API Endpoints Organization

This directory contains organized API endpoint definitions for the GymLogger application.

## Authentication & Authorization

All endpoints use **claims-based authentication** with cookie authentication and a **default authorization policy** that requires authenticated users.

### Default Authorization Policy

A **fallback policy** is configured in `Program.cs` that requires all users to be authenticated by default:

```csharp
builder.Services.AddAuthorization(options =>
{
    options.FallbackPolicy = new AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .Build();
});
```

This means:
- **All endpoints require authentication by default** - No need to add `.RequireAuthorization()` to every route group
- **Public endpoints must explicitly opt-out** using `.AllowAnonymous()`
- **Role-based endpoints still use explicit policies** like `.RequireAuthorization(policy => policy.RequireRole("Admin"))`

### Authentication Flow

1. **Entra ID Login** (`/api/auth/login`): Redirects to Microsoft Entra ID for OAuth authentication
   - After successful authentication, the `OnTokenValidated` event creates custom claims
   - User ID (`ClaimTypes.NameIdentifier`) is set to the internal app user ID
   - Admin users get a `ClaimTypes.Role = "Admin"` claim

2. **Guest Login** (`/api/auth/guest`): Creates a guest session
   - Generates a guest user ID
   - Creates claims with user ID and auth type
   - Sets a persistent cookie (180 days)

3. **User ID in Claims**: The internal app user ID is stored in `ClaimTypes.NameIdentifier`
   - Accessible via `httpContext.GetUserId()` extension method
   - No manual middleware needed - handled by ASP.NET Core authorization

### Authorization Patterns

With the fallback policy in place:

- **Default (no attribute)**: Requires authenticated user (handled by fallback policy)
- **`.AllowAnonymous()`**: Public endpoint, no authentication required
- **`.RequireAuthorization(policy => policy.RequireRole("Admin"))`**: Requires Admin role

### Route Groups

All endpoints use route groups for clean organization. Authentication is enforced by the fallback policy:

```csharp
// Authenticated by default (fallback policy)
var group = app.MapGroup("/api/users/me/programs");
group.MapGet("/", async (HttpContext httpContext, ProgramRepository repo) => { ... });

// Public endpoint - must explicitly allow anonymous
var publicGroup = app.MapGroup("/api/templates")
    .AllowAnonymous();
    
// Admin only - explicit role requirement
var adminGroup = app.MapGroup("/api/admin/exercises")
    .RequireAuthorization(policy => policy.RequireRole("Admin"));
```

## Structure

The endpoints are organized into the following groups:

### ExerciseEndpoints.cs

**Authorization**: Authenticated by default (fallback policy), except admin endpoints require Admin role

- `GET /api/exercises` - Get all exercises (shared + user's custom)
- `POST /api/exercises` - Create a new user exercise
- `PUT /api/users/me/exercises/{id}` - Update a user exercise
- `DELETE /api/users/me/exercises/{id}` - Delete a user exercise
- `POST /api/admin/exercises` - Create a shared exercise (**Admin role required**)

### ProgramEndpoints.cs

**Authorization**: Authenticated by default (fallback policy)
- `GET /api/users/me/programs` - Get user's workout programs (optionally filtered by day)
- `GET /api/users/me/programs/{id}` - Get a specific program
- `POST /api/users/me/programs` - Create a new program
- `PUT /api/users/me/programs/{id}` - Update a program
- `PATCH /api/users/me/programs/{id}/set-default` - Set program as default
- `DELETE /api/users/me/programs/{id}` - Delete a program

### SessionEndpoints.cs

**Authorization**: Authenticated by default (fallback policy)
- `GET /api/users/me/sessions/active` - Get active workout session
- `GET /api/users/me/sessions/last-for-program/{programId}` - Get last session for a program
- `GET /api/users/me/sessions` - Get all sessions (with date range filter)
- `GET /api/users/me/sessions/{id}` - Get a specific session with sets
- `POST /api/users/me/sessions` - Create a new session
- `PUT /api/users/me/sessions/{id}` - Update a session
- `POST /api/users/me/sessions/{id}/cleanup` - Clean up empty exercises from session
- `GET /api/users/me/sessions/{sessionId}/sets` - Get all sets for a session
- `POST /api/users/me/sessions/{sessionId}/sets` - Add a set to a session
- `PUT /api/users/me/sessions/{sessionId}/sets/{setId}` - Update a set
- `DELETE /api/users/me/sessions/{sessionId}/sets/{setId}` - Delete a set

### UserEndpoints.cs

**Authorization**: Authenticated by default (fallback policy)
- `GET /api/users/me/preferences` - Get user preferences
- `PUT /api/users/me/preferences` - Update user preferences

### StatsEndpoints.cs

**Authorization**: Authenticated by default (fallback policy)
- `GET /api/users/me/stats/by-exercise` - Get statistics grouped by exercise
- `GET /api/users/me/stats/by-program/{programId}` - Get statistics for a specific program
- `GET /api/users/me/stats/by-muscle` - Get statistics grouped by muscle group
- `GET /api/users/me/stats/history/{exerciseId}` - Get exercise history over time

### IntegrationEndpoints.cs

**Authorization**: Mixed
- Outbound integration: Authenticated by default (fallback policy)
- Import endpoint: Public (AllowAnonymous) - uses API key authentication
- `POST /api/users/me/sessions/{sessionId}/submit-integration` - Submit workout data to external integration
- `POST /api/import` - Import workout data (authenticated via API key)

### TemplateEndpoints.cs

**Authorization**: Public (AllowAnonymous)
- `GET /api/templates` - Get predefined program templates

### SyncEndpoints.cs

**Authorization**: Authenticated by default (fallback policy)
- `POST /api/sync` - Sync endpoint for offline data (placeholder)

## Extension Methods

### HttpContextExtensions.cs

Contains extension methods for accessing user information from claims:

- **`GetUserId(this HttpContext)`**: Gets the authenticated user's internal app user ID from claims
- **`GetUserId(this ClaimsPrincipal)`**: Gets the user ID directly from ClaimsPrincipal

Both methods throw `InvalidOperationException` if the user is not authenticated or user ID claim is missing.

## Usage in Program.cs

All endpoint groups are registered in `Program.cs` using extension methods:

```csharp
app.MapAdminEndpoints();
app.MapExerciseEndpoints();
app.MapProgramEndpoints();
app.MapSessionEndpoints();
app.MapUserEndpoints();
app.MapStatsEndpoints();
app.MapIntegrationEndpoints();
app.MapTemplateEndpoints();
app.MapSyncEndpoints();
```

### Authentication Setup

The authentication is configured in Program.cs with:

1. **Cookie + OpenID Connect authentication**
2. **OnTokenValidated event** for Entra ID that:
   - Gets or creates the internal app user ID
   - Adds custom claims (user ID, external ID, auth type)
   - Adds Admin role claim if applicable
3. **AuthController** handles guest login with similar claim creation

## Benefits of This Organization

1. **Separation of Concerns**: Each endpoint group is in its own file
2. **Maintainability**: Easier to find and modify specific endpoints
3. **Testability**: Each group can be tested independently
4. **Scalability**: Easy to add new endpoint groups
5. **Readability**: Program.cs is much cleaner and focused on configuration
6. **Standard Authorization**: Uses ASP.NET Core's built-in authorization with fallback policy
7. **Claims-Based Identity**: User ID is stored in claims, accessible anywhere via `GetUserId()`
8. **Role-Based Access Control**: Admin endpoints use standard role requirements
9. **Route Groups**: Clean organization with consistent authorization policies
10. **Secure by Default**: All endpoints require authentication unless explicitly allowed
