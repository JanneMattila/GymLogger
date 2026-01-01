using GymLogger.Models;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using System.Text;

namespace GymLogger.Services;

public class ReportService
{
    private readonly ILogger<ReportService> _logger;

    public ReportService(ILogger<ReportService> logger)
    {
        _logger = logger;
    }

    public (byte[] Data, string ContentType, string Extension) GenerateWorkoutReport(
        string startDate,
        string endDate,
        List<WorkoutSession> sessions,
        Dictionary<string, List<WorkoutSet>> setsBySession,
        Dictionary<string, Exercise> exerciseLookup,
        string format = "pdf")
    {
        _logger.LogInformation("Generating workout report ({Format}) for {StartDate} to {EndDate}", format, startDate, endDate);

        // Build report data rows
        var reportRows = BuildReportRows(sessions, setsBySession, exerciseLookup);

        if (format.Equals("csv", StringComparison.OrdinalIgnoreCase))
        {
            var csvBytes = GenerateCsvReport(reportRows);
            return (csvBytes, "text/csv", "csv");
        }
        else
        {
            var pdfBytes = GeneratePdfReport(startDate, endDate, reportRows);
            return (pdfBytes, "application/pdf", "pdf");
        }
    }

    private List<ReportRow> BuildReportRows(
        List<WorkoutSession> sessions,
        Dictionary<string, List<WorkoutSet>> setsBySession,
        Dictionary<string, Exercise> exerciseLookup)
    {
        var reportRows = new List<ReportRow>();

        foreach (var session in sessions.OrderBy(s => s.SessionDate))
        {
            if (!setsBySession.TryGetValue(session.Id, out var sets))
                continue;

            var sessionDate = DateTime.Parse(session.SessionDate);
            var dayOfWeek = sessionDate.DayOfWeek.ToString();

            foreach (var set in sets.Where(s => !s.IsWarmup).OrderBy(s => s.SetNumber))
            {
                var exercise = exerciseLookup.GetValueOrDefault(set.ExerciseId);
                var exerciseName = exercise?.Name ?? "Unknown Exercise";
                var muscleGroup = exercise?.MuscleGroup ?? "N/A";
                var equipmentType = exercise?.EquipmentType ?? "N/A";

                // Find set number within exercise for this session
                var exerciseSets = sets
                    .Where(s => s.ExerciseId == set.ExerciseId && !s.IsWarmup)
                    .OrderBy(s => s.SetNumber)
                    .ToList();
                var setNumber = exerciseSets.IndexOf(set) + 1;
                var totalSets = exerciseSets.Count;

                reportRows.Add(new ReportRow
                {
                    Date = session.SessionDate,
                    DayOfWeek = dayOfWeek,
                    Reps = set.Reps ?? 0,
                    Weight = set.Weight ?? 0,
                    ExerciseName = exerciseName,
                    Description = $"{muscleGroup} - {equipmentType} - Working set {setNumber} of {totalSets}"
                });
            }
        }

        return reportRows;
    }

    private byte[] GenerateCsvReport(List<ReportRow> rows)
    {
        var sb = new StringBuilder();
        
        // Header row (tab-separated)
        sb.AppendLine("Date\tDay\tReps\tWeight\tExercise\tDescription");

        // Data rows (tab-separated)
        foreach (var row in rows)
        {
            // Escape fields that might contain tabs or newlines
            var escapedExercise = EscapeTsvField(row.ExerciseName);
            var escapedDescription = EscapeTsvField(row.Description);
            
            sb.AppendLine($"{row.Date}\t{row.DayOfWeek}\t{row.Reps}\t{row.Weight:0.##}\t{escapedExercise}\t{escapedDescription}");
        }

        return Encoding.UTF8.GetBytes(sb.ToString());
    }

    private static string EscapeTsvField(string field)
    {
        if (string.IsNullOrEmpty(field))
            return string.Empty;

        // Replace tabs and newlines with spaces
        return field.Replace("\t", " ").Replace("\n", " ").Replace("\r", "");
    }

    private byte[] GeneratePdfReport(string startDate, string endDate, List<ReportRow> rows)
    {
        var document = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(30);
                page.DefaultTextStyle(x => x.FontSize(10));

                page.Header().Element(c => ComposeHeader(c, startDate, endDate));
                page.Content().Element(c => ComposeContent(c, rows));
                page.Footer().AlignCenter().Text(text =>
                {
                    text.Span("Page ");
                    text.CurrentPageNumber();
                    text.Span(" of ");
                    text.TotalPages();
                });
            });
        });

        return document.GeneratePdf();
    }

    private void ComposeHeader(IContainer container, string startDate, string endDate)
    {
        container.Column(column =>
        {
            column.Item().Text("Workout Report")
                .FontSize(20)
                .SemiBold()
                .FontColor(Colors.Blue.Medium);

            column.Item().Text($"Period: {startDate} to {endDate}")
                .FontSize(12)
                .FontColor(Colors.Grey.Medium);

            column.Item().PaddingVertical(10).LineHorizontal(1).LineColor(Colors.Grey.Lighten2);
        });
    }

    private void ComposeContent(IContainer container, List<ReportRow> rows)
    {
        if (rows.Count == 0)
        {
            container.PaddingVertical(20).Text("No workout data found for this period.")
                .FontSize(12)
                .FontColor(Colors.Grey.Medium);
            return;
        }

        container.Column(mainColumn =>
        {
            mainColumn.Item().Table(table =>
            {
                // Define columns
                table.ColumnsDefinition(columns =>
                {
                    columns.ConstantColumn(75);  // Date
                    columns.ConstantColumn(70);  // Day of Week
                    columns.ConstantColumn(40);  // Reps
                    columns.ConstantColumn(50);  // Weight
                    columns.RelativeColumn(2);   // Exercise Name
                    columns.RelativeColumn(3);   // Description
                });

                // Header row
                table.Header(header =>
                {
                    header.Cell().Element(CellStyle).Text("Date").SemiBold();
                    header.Cell().Element(CellStyle).Text("Day").SemiBold();
                    header.Cell().Element(CellStyle).AlignRight().Text("Reps").SemiBold();
                    header.Cell().Element(CellStyle).AlignRight().Text("Weight").SemiBold();
                    header.Cell().Element(CellStyle).Text("Exercise").SemiBold();
                    header.Cell().Element(CellStyle).Text("Description").SemiBold();

                    static IContainer CellStyle(IContainer c)
                    {
                        return c
                            .DefaultTextStyle(x => x.SemiBold())
                            .PaddingVertical(5)
                            .BorderBottom(1)
                            .BorderColor(Colors.Black);
                    }
                });

                // Data rows
                foreach (var row in rows)
                {
                    table.Cell().Element(CellStyle).Text(row.Date);
                    table.Cell().Element(CellStyle).Text(row.DayOfWeek);
                    table.Cell().Element(CellStyle).AlignRight().Text(row.Reps.ToString());
                    table.Cell().Element(CellStyle).AlignRight().Text(row.Weight.ToString("0.##"));
                    table.Cell().Element(CellStyle).Text(row.ExerciseName);
                    table.Cell().Element(CellStyle).Text(row.Description);

                    static IContainer CellStyle(IContainer c)
                    {
                        return c
                            .PaddingVertical(4)
                            .BorderBottom(1)
                            .BorderColor(Colors.Grey.Lighten2);
                    }
                }
            });

            // Summary
            mainColumn.Item().PaddingTop(20).Column(summaryColumn =>
            {
                summaryColumn.Item().Text($"Total Sets: {rows.Count}")
                    .FontSize(11)
                    .SemiBold();

                var uniqueDays = rows.Select(r => r.Date).Distinct().Count();
                summaryColumn.Item().Text($"Workout Days: {uniqueDays}")
                    .FontSize(11);

                var uniqueExercises = rows.Select(r => r.ExerciseName).Distinct().Count();
                summaryColumn.Item().Text($"Unique Exercises: {uniqueExercises}")
                    .FontSize(11);
            });
        });
    }

    private class ReportRow
    {
        public required string Date { get; set; }
        public required string DayOfWeek { get; set; }
        public int Reps { get; set; }
        public decimal Weight { get; set; }
        public required string ExerciseName { get; set; }
        public required string Description { get; set; }
    }
}
