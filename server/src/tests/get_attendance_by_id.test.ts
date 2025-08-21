import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { teacherAttendanceTable, schoolLocationsTable } from '../db/schema';
import { getAttendanceById } from '../handlers/get_attendance_by_id';
import { eq } from 'drizzle-orm';

describe('getAttendanceById', () => {
  let schoolLocationId: number;
  let attendanceId: number;

  beforeEach(async () => {
    await createDB();
    
    // Create a school location first (required for attendance records)
    const schoolLocationResult = await db.insert(schoolLocationsTable)
      .values({
        name: 'Test School',
        latitude: '40.7128',
        longitude: '-74.0060',
        radius_meters: 100
      })
      .returning()
      .execute();
    
    schoolLocationId = schoolLocationResult[0].id;

    // Create a test attendance record
    const attendanceResult = await db.insert(teacherAttendanceTable)
      .values({
        teacher_name: 'John Doe',
        attendance_date: '2024-01-15',
        clock_in_time: '08:30:00',
        clock_out_time: '16:45:00',
        photo_url: '/photos/john_doe_20240115.jpg',
        location_latitude: '40.7130',
        location_longitude: '-74.0058',
        school_location_id: schoolLocationId,
        is_location_valid: true
      })
      .returning()
      .execute();
    
    attendanceId = attendanceResult[0].id;
  });

  afterEach(resetDB);

  it('should retrieve attendance record by ID', async () => {
    const result = await getAttendanceById(attendanceId);

    expect(result).not.toBeNull();
    expect(result!.id).toBe(attendanceId);
    expect(result!.teacher_name).toBe('John Doe');
    expect(result!.attendance_date).toBeInstanceOf(Date);
    expect(result!.clock_in_time).toBe('08:30:00');
    expect(result!.clock_out_time).toBe('16:45:00');
    expect(result!.photo_url).toBe('/photos/john_doe_20240115.jpg');
    expect(result!.school_location_id).toBe(schoolLocationId);
    expect(result!.is_location_valid).toBe(true);
    expect(result!.created_at).toBeInstanceOf(Date);
    expect(result!.updated_at).toBeInstanceOf(Date);
  });

  it('should return attendance record with correct numeric location coordinates', async () => {
    const result = await getAttendanceById(attendanceId);

    expect(result).not.toBeNull();
    expect(typeof result!.location_latitude).toBe('number');
    expect(typeof result!.location_longitude).toBe('number');
    expect(result!.location_latitude).toBe(40.7130);
    expect(result!.location_longitude).toBe(-74.0058);
  });

  it('should return null for non-existent attendance ID', async () => {
    const nonExistentId = 99999;
    const result = await getAttendanceById(nonExistentId);

    expect(result).toBeNull();
  });

  it('should handle attendance record without clock out time', async () => {
    // Create attendance record without clock out time
    const incompleteAttendanceResult = await db.insert(teacherAttendanceTable)
      .values({
        teacher_name: 'Jane Smith',
        attendance_date: '2024-01-16',
        clock_in_time: '09:00:00',
        clock_out_time: null, // No clock out time
        photo_url: '/photos/jane_smith_20240116.jpg',
        location_latitude: '40.7125',
        location_longitude: '-74.0065',
        school_location_id: schoolLocationId,
        is_location_valid: true
      })
      .returning()
      .execute();
    
    const incompleteAttendanceId = incompleteAttendanceResult[0].id;
    const result = await getAttendanceById(incompleteAttendanceId);

    expect(result).not.toBeNull();
    expect(result!.teacher_name).toBe('Jane Smith');
    expect(result!.clock_in_time).toBe('09:00:00');
    expect(result!.clock_out_time).toBeNull();
    expect(typeof result!.location_latitude).toBe('number');
    expect(typeof result!.location_longitude).toBe('number');
  });

  it('should handle attendance record with invalid location', async () => {
    // Create attendance record with invalid location
    const invalidLocationAttendanceResult = await db.insert(teacherAttendanceTable)
      .values({
        teacher_name: 'Bob Wilson',
        attendance_date: '2024-01-17',
        clock_in_time: '08:45:00',
        clock_out_time: '17:00:00',
        photo_url: '/photos/bob_wilson_20240117.jpg',
        location_latitude: '40.8000', // Outside allowed radius
        location_longitude: '-74.1000', // Outside allowed radius
        school_location_id: schoolLocationId,
        is_location_valid: false // Location validation failed
      })
      .returning()
      .execute();
    
    const invalidLocationAttendanceId = invalidLocationAttendanceResult[0].id;
    const result = await getAttendanceById(invalidLocationAttendanceId);

    expect(result).not.toBeNull();
    expect(result!.teacher_name).toBe('Bob Wilson');
    expect(result!.is_location_valid).toBe(false);
    expect(result!.location_latitude).toBe(40.8000);
    expect(result!.location_longitude).toBe(-74.1000);
  });

  it('should verify database record exists and matches returned data', async () => {
    const result = await getAttendanceById(attendanceId);

    // Verify the record exists in database with correct values
    const dbRecord = await db.select()
      .from(teacherAttendanceTable)
      .where(eq(teacherAttendanceTable.id, attendanceId))
      .execute();

    expect(dbRecord).toHaveLength(1);
    expect(result!.teacher_name).toBe(dbRecord[0].teacher_name);
    expect(result!.attendance_date).toEqual(new Date(dbRecord[0].attendance_date));
    expect(result!.school_location_id).toBe(dbRecord[0].school_location_id);
    
    // Verify numeric conversion was applied correctly
    expect(parseFloat(dbRecord[0].location_latitude)).toBe(result!.location_latitude);
    expect(parseFloat(dbRecord[0].location_longitude)).toBe(result!.location_longitude);
  });
});