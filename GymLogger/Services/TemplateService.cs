using GymLogger.Models;

namespace GymLogger.Services;

public class TemplateService
{
    public List<ProgramTemplate> GetTemplates()
    {
        return
        [
            new ProgramTemplate
            {
                Name = "Leg Day",
                Description = "Complete lower body workout focusing on quads, hamstrings, and glutes",
                Exercises =
                [
                    new() { Name = "Barbell Squats", MuscleGroup = "Legs", EquipmentType = "Barbell", TargetSets = 4, TargetReps = "8-12", RestSeconds = 90 },
                    new() { Name = "Leg Press", MuscleGroup = "Legs", EquipmentType = "Machine", TargetSets = 3, TargetReps = "12-15", RestSeconds = 60 },
                    new() { Name = "Walking Lunges", MuscleGroup = "Legs", EquipmentType = "Dumbbell", TargetSets = 3, TargetReps = "10", RestSeconds = 60 },
                    new() { Name = "Leg Curls", MuscleGroup = "Legs", EquipmentType = "Machine", TargetSets = 3, TargetReps = "12", RestSeconds = 60 }
                ]
            },
            new ProgramTemplate
            {
                Name = "Push Day",
                Description = "Upper body pushing movements for chest, shoulders, and triceps",
                Exercises =
                [
                    new() { Name = "Barbell Bench Press", MuscleGroup = "Chest", EquipmentType = "Barbell", TargetSets = 4, TargetReps = "8-10", RestSeconds = 120 },
                    new() { Name = "Overhead Press", MuscleGroup = "Shoulders", EquipmentType = "Barbell", TargetSets = 3, TargetReps = "8-10", RestSeconds = 90 },
                    new() { Name = "Dips", MuscleGroup = "Chest", EquipmentType = "Bodyweight", TargetSets = 3, TargetReps = "8-12", RestSeconds = 90 },
                    new() { Name = "Tricep Extensions", MuscleGroup = "Arms", EquipmentType = "Cable", TargetSets = 3, TargetReps = "12", RestSeconds = 60 }
                ]
            },
            new ProgramTemplate
            {
                Name = "Pull Day",
                Description = "Upper body pulling movements for back and biceps",
                Exercises =
                [
                    new() { Name = "Deadlifts", MuscleGroup = "Back", EquipmentType = "Barbell", TargetSets = 4, TargetReps = "5-8", RestSeconds = 180 },
                    new() { Name = "Barbell Rows", MuscleGroup = "Back", EquipmentType = "Barbell", TargetSets = 4, TargetReps = "8-10", RestSeconds = 90 },
                    new() { Name = "Pull-ups", MuscleGroup = "Back", EquipmentType = "Bodyweight", TargetSets = 3, TargetReps = "max", RestSeconds = 90 },
                    new() { Name = "Bicep Curls", MuscleGroup = "Arms", EquipmentType = "Dumbbell", TargetSets = 3, TargetReps = "10-12", RestSeconds = 60 }
                ]
            },
            new ProgramTemplate
            {
                Name = "Upper Body",
                Description = "Complete upper body workout combining pushing and pulling",
                Exercises =
                [
                    new() { Name = "Barbell Bench Press", MuscleGroup = "Chest", EquipmentType = "Barbell", TargetSets = 4, TargetReps = "8-10", RestSeconds = 120 },
                    new() { Name = "Barbell Rows", MuscleGroup = "Back", EquipmentType = "Barbell", TargetSets = 4, TargetReps = "8-10", RestSeconds = 90 },
                    new() { Name = "Overhead Press", MuscleGroup = "Shoulders", EquipmentType = "Barbell", TargetSets = 3, TargetReps = "8-10", RestSeconds = 90 },
                    new() { Name = "Pull-ups", MuscleGroup = "Back", EquipmentType = "Bodyweight", TargetSets = 3, TargetReps = "max", RestSeconds = 90 },
                    new() { Name = "Bicep Curls", MuscleGroup = "Arms", EquipmentType = "Dumbbell", TargetSets = 3, TargetReps = "10-12", RestSeconds = 60 },
                    new() { Name = "Tricep Extensions", MuscleGroup = "Arms", EquipmentType = "Cable", TargetSets = 3, TargetReps = "12", RestSeconds = 60 }
                ]
            },
            new ProgramTemplate
            {
                Name = "Lower Body",
                Description = "Comprehensive lower body workout",
                Exercises =
                [
                    new() { Name = "Barbell Squats", MuscleGroup = "Legs", EquipmentType = "Barbell", TargetSets = 4, TargetReps = "8-12", RestSeconds = 90 },
                    new() { Name = "Romanian Deadlifts", MuscleGroup = "Legs", EquipmentType = "Barbell", TargetSets = 3, TargetReps = "10-12", RestSeconds = 90 },
                    new() { Name = "Leg Press", MuscleGroup = "Legs", EquipmentType = "Machine", TargetSets = 3, TargetReps = "12-15", RestSeconds = 60 },
                    new() { Name = "Leg Curls", MuscleGroup = "Legs", EquipmentType = "Machine", TargetSets = 3, TargetReps = "12", RestSeconds = 60 },
                    new() { Name = "Calf Raises", MuscleGroup = "Legs", EquipmentType = "Machine", TargetSets = 4, TargetReps = "15-20", RestSeconds = 45 }
                ]
            },
            new ProgramTemplate
            {
                Name = "Full Body",
                Description = "Complete full body workout hitting all major muscle groups",
                Exercises =
                [
                    new() { Name = "Barbell Squats", MuscleGroup = "Legs", EquipmentType = "Barbell", TargetSets = 3, TargetReps = "8-10", RestSeconds = 90 },
                    new() { Name = "Barbell Bench Press", MuscleGroup = "Chest", EquipmentType = "Barbell", TargetSets = 3, TargetReps = "8-10", RestSeconds = 90 },
                    new() { Name = "Barbell Rows", MuscleGroup = "Back", EquipmentType = "Barbell", TargetSets = 3, TargetReps = "8-10", RestSeconds = 90 },
                    new() { Name = "Overhead Press", MuscleGroup = "Shoulders", EquipmentType = "Barbell", TargetSets = 3, TargetReps = "8-10", RestSeconds = 90 },
                    new() { Name = "Romanian Deadlifts", MuscleGroup = "Legs", EquipmentType = "Barbell", TargetSets = 3, TargetReps = "10", RestSeconds = 90 },
                    new() { Name = "Bicep Curls", MuscleGroup = "Arms", EquipmentType = "Dumbbell", TargetSets = 2, TargetReps = "12", RestSeconds = 60 }
                ]
            }
        ];
    }
}
