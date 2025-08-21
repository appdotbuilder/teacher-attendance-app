import { serial, text, pgTable, timestamp, numeric, integer, boolean, date, time } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// School locations table - predefined school locations with validation radius
export const schoolLocationsTable = pgTable('school_locations', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  latitude: numeric('latitude', { precision: 10, scale:8 }).notNull(), // High precision for GPS coordinates
  longitude: numeric('longitude', { precision: 11, scale: 8 }).notNull(), // High precision for GPS coordinates
  radius_meters: integer('radius_meters').notNull().default(100), // Validation radius in meters
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Teacher attendance table - main attendance records
export const teacherAttendanceTable = pgTable('teacher_attendance', {
  id: serial('id').primaryKey(),
  teacher_name: text('teacher_name').notNull(),
  attendance_date: date('attendance_date').notNull(), // Date only (YYYY-MM-DD)
  clock_in_time: time('clock_in_time').notNull(), // Time only (HH:MM:SS)
  clock_out_time: time('clock_out_time'), // Nullable - teacher might not have clocked out yet
  photo_url: text('photo_url').notNull(), // Path/URL to stored photo
  location_latitude: numeric('location_latitude', { precision: 10, scale: 8 }).notNull(),
  location_longitude: numeric('location_longitude', { precision: 11, scale: 8 }).notNull(),
  school_location_id: integer('school_location_id').references(() => schoolLocationsTable.id).notNull(),
  is_location_valid: boolean('is_location_valid').notNull(), // Whether location was within allowed radius
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Define relations between tables
export const schoolLocationsRelations = relations(schoolLocationsTable, ({ many }) => ({
  attendanceRecords: many(teacherAttendanceTable),
}));

export const teacherAttendanceRelations = relations(teacherAttendanceTable, ({ one }) => ({
  schoolLocation: one(schoolLocationsTable, {
    fields: [teacherAttendanceTable.school_location_id],
    references: [schoolLocationsTable.id],
  }),
}));

// TypeScript types for the table schemas
export type SchoolLocation = typeof schoolLocationsTable.$inferSelect; // For SELECT operations
export type NewSchoolLocation = typeof schoolLocationsTable.$inferInsert; // For INSERT operations

export type TeacherAttendance = typeof teacherAttendanceTable.$inferSelect; // For SELECT operations
export type NewTeacherAttendance = typeof teacherAttendanceTable.$inferInsert; // For INSERT operations

// Export all tables and relations for proper query building
export const tables = { 
  schoolLocations: schoolLocationsTable,
  teacherAttendance: teacherAttendanceTable
};

export const tableRelations = {
  schoolLocationsRelations,
  teacherAttendanceRelations
};