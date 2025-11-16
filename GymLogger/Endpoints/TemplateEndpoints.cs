using GymLogger.Services;

namespace GymLogger.Endpoints;

public static class TemplateEndpoints
{
    public static void MapTemplateEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/templates")
            .RequireAuthorization();

        // Template endpoints
        group.MapGet("/", (TemplateService service) =>
        {
            return service.GetTemplates();
        });
    }
}
