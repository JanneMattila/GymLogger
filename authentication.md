# Authentication Setup Guide

## Overview

The Gym Logger app supports Microsoft Entra ID (Azure AD) authentication with guest mode fallback. The backend handles all OAuth flows and creates cookie-based sessions.

## Architecture

### Backend (C# .NET)
- **Authentication**: Microsoft.Identity.Web for Entra ID integration
- **Session Management**: Cookie-based authentication
- **User IDs**: 
  - Microsoft users: Entra ID object ID (oid claim)
  - Guest users: UUID-Guest format
- **Endpoints**:
  - `GET /api/auth/login` - Redirects to Microsoft login
  - `POST /api/auth/guest` - Creates guest session with cookie
  - `POST /api/auth/logout` - Clears session
  - `GET /api/auth/status` - Returns auth status and userId

### Frontend (JavaScript SPA)
- **Welcome Dialog**: Shows on first visit with two options
  - Sign in with Microsoft
  - Continue as Guest
- **Auth Manager**: Handles session state and localStorage
- **User ID Storage**: Persists in localStorage for session continuity

## Session Management & Cookie Security

### Sliding Expiration (User-Friendly)
The app uses **sliding expiration** for cookies:
- Each time you use the app, your session extends another **90 days**
- If you use the app every week, **you'll never be asked to log in again**
- This balances security with convenience

### Absolute Expiration (Security Boundary)
- Cookies expire after **90 days maximum**, regardless of activity
- After 90 days, you must log in again, even if you use the app daily
- This provides a security boundary for password changes, permission updates, and device compromise recovery

### Recommended Usage Pattern
- **Active users** (weekly+): Never prompted to authenticate thanks to sliding expiration
- **Dormant users**: Prompted to authenticate after 90 days of inactivity
- **Security-conscious**: Can manually log out anytime via Settings → Logout

This approach combines:
- ✅ **Usability**: Active users have seamless experience
- ✅ **Security**: Maximum 90-day session life limits exposure
- ✅ **Best Practices**: Aligns with OWASP and industry standards

## Setup Steps

### 1. Azure AD App Registration

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** → **App registrations** → **New registration**
3. Configure:
   - **Name**: GymLogger
   - **Supported account types**: Personal Microsoft accounts only
   - **Redirect URI**: 
     - Platform: Web
     - URI: `http://localhost:5076/signin-oidc` (development)
     - Add production URL when deploying: `https://yourdomain.com/signin-oidc`

4. After registration, note:
   - **Application (client) ID**

5. Create a client secret:
   - Go to **Certificates & secrets**
   - **New client secret**
   - Note the **Value** (not the Secret ID)

### 2. Configure Secrets (Development)

**IMPORTANT**: Never commit secrets to source control!

Use **User Secrets** for local development:

```bash
# Initialize user secrets (if not already done)
dotnet user-secrets init

# Set the secrets
dotnet user-secrets set "AzureAd:ClientId" "YOUR_APPLICATION_CLIENT_ID_HERE"
dotnet user-secrets set "AzureAd:ClientSecret" "YOUR_CLIENT_SECRET_VALUE_HERE"
```

User secrets are stored outside your project directory at:
- Windows: `%APPDATA%\Microsoft\UserSecrets\<user_secrets_id>\secrets.json`
- Linux/macOS: `~/.microsoft/usersecrets/<user_secrets_id>/secrets.json`

### 3. Update appsettings.json

The `appsettings.json` should contain non-secret configuration:

```json
{
  "AzureAd": {
    "Instance": "https://login.microsoftonline.com/",
    "TenantId": "consumers",
    "CallbackPath": "/signin-oidc"
  }
}
```

**TenantId options**:
- `"consumers"` - Personal Microsoft accounts only (outlook.com, hotmail.com, live.com)
- `"organizations"` - Work/school accounts only
- `"common"` - Both personal and work/school (requires app configured with "All" audience)
- `"{tenant-guid}"` - Specific organization only

**Note**: If you registered for "Personal Microsoft accounts only", use `"consumers"`.

### 4. Production Configuration

For production, use environment variables or Azure Key Vault:

**Option A: Environment Variables** (Azure App Service, Container Apps)
```bash
AzureAd__ClientId=your-client-id
AzureAd__ClientSecret=your-client-secret
```

**Option B: Azure Key Vault**
```csharp
builder.Configuration.AddAzureKeyVault(
    new Uri($"https://{keyVaultName}.vault.azure.net/"),
    new DefaultAzureCredential());
```

### 5. Update Redirect URIs for Production

In your Azure AD app registration, add production redirect URIs:
- `https://your-production-domain.com/signin-oidc`

## User Flow

### First-Time Visitor
1. App loads → auth manager checks localStorage for userId
2. No userId found → Welcome dialog appears
3. User chooses:
   - **Microsoft Sign In**: Redirects to `/api/auth/login` → Entra ID → callback → cookie created → userId stored in localStorage
   - **Continue as Guest**: POST to `/api/auth/guest` → generates UUID-Guest → cookie created → userId stored in localStorage

### Returning Visitor
1. App loads → auth manager finds userId in localStorage
2. Calls `/api/auth/status` to verify backend session
3. If valid: Continue with stored userId
4. If invalid: Show welcome dialog again

### Logout
1. User clicks logout in Preferences
2. POST to `/api/auth/logout` → clears cookie
3. localStorage cleared → redirects to home → welcome dialog shows

## Data Storage

### Backend Storage
- User data stored in `data/users/{userId}/` folder structure
- Same storage mechanism for both Microsoft and guest users
- Guest IDs are permanent (UUID-based) so data persists across browser sessions

## Development Testing

### Test Microsoft Login
1. Ensure secrets are configured via user-secrets:
   ```bash
   dotnet user-secrets list
   ```
2. Navigate to `http://localhost:5076`
3. Click "Sign in with Microsoft"
4. Login with any personal Microsoft account (outlook.com, hotmail.com, live.com)
5. Create data and verify persistence across page refreshes

### Test Guest Mode
1. Clear localStorage and cookies
2. Navigate to `http://localhost:5076`
3. Click "Continue as Guest"
4. Create data and verify persistence across page refreshes
