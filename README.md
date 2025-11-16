# GymLogger

A comprehensive workout tracking application built with ASP.NET Core and vanilla JavaScript.

## Features

- 💪 Track workout sessions and exercises
- 📊 View statistics and progress over time
- 🏋️ Manage workout programs
- ⏱️ Rest timer with customizable duration
- 🔄 Offline support with automatic sync
- 🎨 Dark/Light theme support
- 🔐 Azure AD authentication (optional guest mode)
- 🔌 Outbound/Inbound integrations

## Database Setup

### SQL Server

#### Using Docker (in Development)

1. **Start SQL Server container:**
   ```powershell
   docker-compose up -d
   ```

2. **Verify container is running:**
   ```powershell
   docker ps
   ```

3. **Run migrations:**
   ```powershell
   cd GymLogger
   dotnet ef database update
   ```

#### Using Local SQL Server

1. **Install SQL Server:**
   - Download [SQL Server Developer Edition](https://www.microsoft.com/en-us/sql-server/sql-server-downloads)
   - Or use SQL Server Express

2. **Update connection string in `appsettings.json`:**
   ```json
   {
     "DatabaseProvider": "SqlServer",
     "ConnectionStrings": {
       "SqlServer": "Server=localhost;Database=GymLogger;Integrated Security=true;TrustServerCertificate=True"
     }
   }
   ```

3. **Run migrations:**
   ```powershell
   cd GymLogger
   dotnet ef database update
   ```

### SQLite (Development Only)

To use SQLite instead:

1. **Update `appsettings.json`:**
   ```json
   {
     "DatabaseProvider": "SQLite",
     "ConnectionStrings": {
       "SQLite": "Data Source=data/gymlogger.db;Cache=Shared"
     }
   }
   ```

2. **Run migrations:**
   ```powershell
   cd GymLogger
   dotnet ef database update
   ```

## Running the Application

1. **Restore dependencies:**
   ```powershell
   cd GymLogger
   dotnet restore
   ```

2. **Run the application:**
   ```powershell
   dotnet run
   ```

3. **Open browser:**
   Navigate to `https://localhost:5001` or the URL shown in the terminal

## Development

### Creating Migrations

When you make changes to entities:

```powershell
cd GymLogger
dotnet ef migrations add YourMigrationName
dotnet ef database update
```

### Docker Commands

**Start SQL Server:**
```powershell
docker-compose up -d
```

**Stop SQL Server:**
```powershell
docker-compose down
```

**View logs:**
```powershell
docker-compose logs -f sqlserver
```

**Connect to SQL Server:**
```powershell
docker exec -it gymlogger-sqlserver /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P YourStrong@Passw0rd -C
```

### Database Connection Strings

**Docker SQL Server:**
```
Server=localhost,1433;Database=GymLogger;User Id=sa;Password=YourStrong@Passw0rd;TrustServerCertificate=True
```

**Local SQL Server (Windows Authentication):**
```
Server=localhost;Database=GymLogger;Integrated Security=true;TrustServerCertificate=True
```

**SQLite:**
```
Data Source=data/gymlogger.db;Cache=Shared
```

## Integrations

### Outbound Integration

Send workout data to external systems when completing a workout:

1. Go to **Preferences** > **Outbound Integration**
2. Enable the integration
3. Enter your external API endpoint URL
4. Workout data will be automatically sent upon completion

### Inbound Integration

Import workout data from external systems:

1. Go to **Preferences** > **Inbound Integration**
2. Enable the integration
3. Copy your unique API endpoint URL
4. Send POST requests to this endpoint with workout data

**Example request:**
```bash
POST /api/import?key=your-api-key
Content-Type: application/json

[
  {
    "date": "2025-11-12",
    "qty": 12,
    "weight": 225,
    "title": "Bench Press",
    "description": "Chest - Barbell - Working set"
  }
]
```

## Configuration

### Entra ID Authentication

Update `appsettings.json`:
```json
{
  "AzureAd": {
    "Instance": "https://login.microsoftonline.com/",
    "TenantId": "consumers",
    "ClientId": "YOUR_CLIENT_ID",
    "ClientSecret": "YOUR_CLIENT_SECRET",
    "CallbackPath": "/signin-oidc"
  }
}
```

### Environment Variables

You can also use environment variables (recommended for production):
- `DatabaseProvider`: "SqlServer" or "SQLite"
- `ConnectionStrings__SqlServer`: SQL Server connection string
- `AzureAd__ClientId`: Azure AD Client ID
- `AzureAd__ClientSecret`: Azure AD Client Secret

## Tech Stack

- **Backend:** ASP.NET Core 10.0 (Minimal APIs)
- **Database:** SQL Server / SQLite
- **ORM:** Entity Framework Core
- **Frontend:** Vanilla JavaScript (ES6+)
- **Authentication:** Entra ID with OpenID Connect
- **Offline Storage:** IndexedDB

## License

MIT
