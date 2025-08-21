import { db } from '../db';
import { teacherAttendanceTable, schoolLocationsTable } from '../db/schema';
import { type TeacherAttendance } from '../schema';
import { eq } from 'drizzle-orm';

/**
 * Retrieves a specific attendance record by its ID.
 * This handler is useful for getting detailed information about a single attendance entry.
 */
export async function getAttendanceById(attendanceId: number): Promise<TeacherAttendance | null> {
  try {
    // Query attendance record with school location data
    const result = await db.select()
      .from(teacherAttendanceTable)
      .innerJoin(
        schoolLocationsTable,
        eq(teacherAttendanceTable.school_location_id, schoolLocationsTable.id)
      )
      .where(eq(teacherAttendanceTable.id, attendanceId))
      .execute();

    if (result.length === 0) {
      return null;
    }

    // Extract the attendance data from the joined result
    const attendanceData = result[0].teacher_attendance;

    // Convert numeric and date fields for the response
    return {
      ...attendanceData,
      attendance_date: new Date(attendanceData.attendance_date),
      location_latitude: parseFloat(attendanceData.location_latitude),
      location_longitude: parseFloat(attendanceData.location_longitude)
    };
  } catch (error) {
    console.error('Failed to retrieve attendance by ID:', error);
    throw error;
  }
}