import { db } from '../db';
import { schoolLocationsTable, teacherAttendanceTable } from '../db/schema';
import { type ClockInInput, type TeacherAttendance } from '../schema';
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
  const φ1 = lat1 * Math.PI / 180; // Convert latitude to radians
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

/**
 * Handles teacher clock-in process including location validation and photo storage.
 * This handler creates a new attendance record when a teacher starts their work day.
 * It validates GPS location, stores the photo, and records the clock-in time.
 */
export async function clockIn(input: ClockInInput): Promise<TeacherAttendance> {
  try {
    // 1. Fetch and validate school location exists
    const schoolLocationResult = await db.select()
      .from(schoolLocationsTable)
      .where(eq(schoolLocationsTable.id, input.school_location_id))
      .execute();

    if (schoolLocationResult.length === 0) {
      throw new Error(`School location with ID ${input.school_location_id} not found`);
    }

    const schoolLocation = schoolLocationResult[0];

    // 2. Calculate distance and validate location
    const distance = calculateDistance(
      input.location.latitude,
      input.location.longitude,
      parseFloat(schoolLocation.latitude), // Convert numeric string to number
      parseFloat(schoolLocation.longitude)
    );

    const isLocationValid = distance <= schoolLocation.radius_meters;

    // 3. Create attendance record in database
    const attendanceResult = await db.insert(teacherAttendanceTable)
      .values({
        teacher_name: input.teacher_name,
        attendance_date: input.attendance_date,
        clock_in_time: input.clock_in_time,
        clock_out_time: null, // Not clocked out yet
        photo_url: input.photo_url,
        location_latitude: input.location.latitude.toString(), // Convert number to string for numeric column
        location_longitude: input.location.longitude.toString(),
        school_location_id: input.school_location_id,
        is_location_valid: isLocationValid
      })
      .returning()
      .execute();

    // 4. Convert and return the created record
    const attendanceRecord = attendanceResult[0];
    return {
      ...attendanceRecord,
      location_latitude: parseFloat(attendanceRecord.location_latitude), // Convert string back to number
      location_longitude: parseFloat(attendanceRecord.location_longitude),
      attendance_date: new Date(attendanceRecord.attendance_date + 'T00:00:00'), // Convert date string to Date
      created_at: attendanceRecord.created_at,
      updated_at: attendanceRecord.updated_at
    };
  } catch (error) {
    console.error('Clock-in failed:', error);
    throw error;
  }
}