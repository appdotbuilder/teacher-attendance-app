import { z } from 'zod';

// GPS location schema
export const locationSchema = z.object({
  latitude: z.number().min(-90).max(90), // Valid latitude range
  longitude: z.number().min(-180).max(180), // Valid longitude range
});

export type Location = z.infer<typeof locationSchema>;

// School location configuration schema
export const schoolLocationSchema = z.object({
  id: z.number(),
  name: z.string(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radius_meters: z.number().int().positive().default(100), // Validation radius in meters
  created_at: z.coerce.date(),
});

export type SchoolLocation = z.infer<typeof schoolLocationSchema>;

// Teacher attendance schema
export const teacherAttendanceSchema = z.object({
  id: z.number(),
  teacher_name: z.string(),
  attendance_date: z.coerce.date(),
  clock_in_time: z.string(), // Time format: HH:MM:SS
  clock_out_time: z.string().nullable(), // Can be null if not clocked out yet
  photo_url: z.string(), // URL/path to the stored photo
  location_latitude: z.number().min(-90).max(90),
  location_longitude: z.number().min(-180).max(180),
  school_location_id: z.number(),
  is_location_valid: z.boolean(), // Whether location is within allowed radius
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
});

export type TeacherAttendance = z.infer<typeof teacherAttendanceSchema>;

// Input schema for creating attendance (clock-in)
export const clockInInputSchema = z.object({
  teacher_name: z.string().min(1, "Teacher name is required"),
  attendance_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  clock_in_time: z.string().regex(/^([01]?\d|2[0-3]):[0-5]\d:[0-5]\d$/, "Time must be in HH:MM:SS format"),
  photo_url: z.string().min(1, "Photo is required"),
  location: locationSchema,
  school_location_id: z.number().int().positive(),
});

export type ClockInInput = z.infer<typeof clockInInputSchema>;

// Input schema for clock-out
export const clockOutInputSchema = z.object({
  attendance_id: z.number().int().positive(),
  clock_out_time: z.string().regex(/^([01]?\d|2[0-3]):[0-5]\d:[0-5]\d$/, "Time must be in HH:MM:SS format"),
  location: locationSchema,
});

export type ClockOutInput = z.infer<typeof clockOutInputSchema>;

// Input schema for creating school location
export const createSchoolLocationInputSchema = z.object({
  name: z.string().min(1, "School name is required"),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radius_meters: z.number().int().positive().default(100),
});

export type CreateSchoolLocationInput = z.infer<typeof createSchoolLocationInputSchema>;

// Query schema for getting attendance records
export const getAttendanceQuerySchema = z.object({
  teacher_name: z.string().optional(),
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  school_location_id: z.number().int().positive().optional(),
}).optional();

export type GetAttendanceQuery = z.infer<typeof getAttendanceQuerySchema>;

// Location validation result schema
export const locationValidationSchema = z.object({
  is_valid: z.boolean(),
  distance_meters: z.number(),
  school_location: schoolLocationSchema,
});

export type LocationValidation = z.infer<typeof locationValidationSchema>;