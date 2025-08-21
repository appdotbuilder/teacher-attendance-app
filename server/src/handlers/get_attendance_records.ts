import { db } from '../db';
import { teacherAttendanceTable, schoolLocationsTable } from '../db/schema';
import { type GetAttendanceQuery, type TeacherAttendance } from '../schema';
import { eq, gte, lte, and, desc, type SQL } from 'drizzle-orm';

/**
 * Retrieves attendance records based on query filters.
 * This handler allows viewing attendance history with optional filters for
 * teacher name, date range, and school location.
 */
export async function getAttendanceRecords(query?: GetAttendanceQuery): Promise<TeacherAttendance[]> {
  try {
    // Build conditions array for filtering
    const conditions: SQL<unknown>[] = [];

    if (query) {
      // Filter by teacher name (exact match)
      if (query.teacher_name) {
        conditions.push(eq(teacherAttendanceTable.teacher_name, query.teacher_name));
      }

      // Filter by date range
      if (query.date_from) {
        conditions.push(gte(teacherAttendanceTable.attendance_date, query.date_from));
      }

      if (query.date_to) {
        conditions.push(lte(teacherAttendanceTable.attendance_date, query.date_to));
      }

      // Filter by school location
      if (query.school_location_id) {
        conditions.push(eq(teacherAttendanceTable.school_location_id, query.school_location_id));
      }
    }

    // Build the complete query with all clauses at once
    let baseQuery = db.select({
      // Select all fields from teacher_attendance table
      id: teacherAttendanceTable.id,
      teacher_name: teacherAttendanceTable.teacher_name,
      attendance_date: teacherAttendanceTable.attendance_date,
      clock_in_time: teacherAttendanceTable.clock_in_time,
      clock_out_time: teacherAttendanceTable.clock_out_time,
      photo_url: teacherAttendanceTable.photo_url,
      location_latitude: teacherAttendanceTable.location_latitude,
      location_longitude: teacherAttendanceTable.location_longitude,
      school_location_id: teacherAttendanceTable.school_location_id,
      is_location_valid: teacherAttendanceTable.is_location_valid,
      created_at: teacherAttendanceTable.created_at,
      updated_at: teacherAttendanceTable.updated_at,
    })
    .from(teacherAttendanceTable)
    .innerJoin(
      schoolLocationsTable,
      eq(teacherAttendanceTable.school_location_id, schoolLocationsTable.id)
    );

    // Apply where clause and ordering in a single chain to avoid type issues
    const results = conditions.length > 0
      ? await baseQuery
          .where(conditions.length === 1 ? conditions[0] : and(...conditions))
          .orderBy(
            desc(teacherAttendanceTable.attendance_date),
            desc(teacherAttendanceTable.clock_in_time)
          )
          .execute()
      : await baseQuery
          .orderBy(
            desc(teacherAttendanceTable.attendance_date),
            desc(teacherAttendanceTable.clock_in_time)
          )
          .execute();

    // Convert numeric fields back to numbers and ensure proper date/time handling
    return results.map(record => ({
      id: record.id,
      teacher_name: record.teacher_name,
      attendance_date: new Date(record.attendance_date), // Convert date string to Date object
      clock_in_time: record.clock_in_time,
      clock_out_time: record.clock_out_time,
      photo_url: record.photo_url,
      location_latitude: parseFloat(record.location_latitude), // Convert numeric to number
      location_longitude: parseFloat(record.location_longitude), // Convert numeric to number
      school_location_id: record.school_location_id,
      is_location_valid: record.is_location_valid,
      created_at: record.created_at,
      updated_at: record.updated_at,
    }));

  } catch (error) {
    console.error('Failed to retrieve attendance records:', error);
    throw error;
  }
}