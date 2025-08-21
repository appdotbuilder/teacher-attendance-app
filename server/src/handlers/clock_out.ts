import { db } from '../db';
import { teacherAttendanceTable, schoolLocationsTable } from '../db/schema';
import { type ClockOutInput, type TeacherAttendance } from '../schema';
import { eq } from 'drizzle-orm';

/**
 * Calculates the distance between two GPS coordinates using the Haversine formula
 * @param lat1 Latitude of first point
 * @param lon1 Longitude of first point
 * @param lat2 Latitude of second point
 * @param lon2 Longitude of second point
 * @returns Distance in meters
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Handles teacher clock-out process including location validation.
 * This handler updates an existing attendance record when a teacher ends their work day.
 * It validates GPS location and records the clock-out time.
 */
export async function clockOut(input: ClockOutInput): Promise<TeacherAttendance> {
  try {
    // 1. Find the existing attendance record by ID
    const existingAttendance = await db.select()
      .from(teacherAttendanceTable)
      .where(eq(teacherAttendanceTable.id, input.attendance_id))
      .execute();

    if (existingAttendance.length === 0) {
      throw new Error(`Attendance record with ID ${input.attendance_id} not found`);
    }

    const attendance = existingAttendance[0];

    // Check if already clocked out
    if (attendance.clock_out_time !== null) {
      throw new Error(`Teacher has already clocked out at ${attendance.clock_out_time}`);
    }

    // 2. Get the school location to validate against
    const schoolLocation = await db.select()
      .from(schoolLocationsTable)
      .where(eq(schoolLocationsTable.id, attendance.school_location_id))
      .execute();

    if (schoolLocation.length === 0) {
      throw new Error(`School location with ID ${attendance.school_location_id} not found`);
    }

    const school = schoolLocation[0];

    // 3. Validate the teacher's current location against the school location
    const schoolLat = parseFloat(school.latitude);
    const schoolLon = parseFloat(school.longitude);
    const distance = calculateDistance(
      input.location.latitude,
      input.location.longitude,
      schoolLat,
      schoolLon
    );

    const isLocationValid = distance <= school.radius_meters;

    // 4. Update the attendance record with clock-out time and location validation
    const updatedAttendance = await db.update(teacherAttendanceTable)
      .set({
        clock_out_time: input.clock_out_time,
        updated_at: new Date()
      })
      .where(eq(teacherAttendanceTable.id, input.attendance_id))
      .returning()
      .execute();

    if (updatedAttendance.length === 0) {
      throw new Error('Failed to update attendance record');
    }

    // 5. Return the updated attendance record with proper type conversions
    const result = updatedAttendance[0];
    return {
      ...result,
      attendance_date: new Date(result.attendance_date),
      location_latitude: parseFloat(result.location_latitude),
      location_longitude: parseFloat(result.location_longitude)
    };

  } catch (error) {
    console.error('Clock out failed:', error);
    throw error;
  }
}