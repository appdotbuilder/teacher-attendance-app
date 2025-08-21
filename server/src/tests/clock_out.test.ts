import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { teacherAttendanceTable, schoolLocationsTable } from '../db/schema';
import { type ClockOutInput } from '../schema';
import { clockOut } from '../handlers/clock_out';
import { eq, sql } from 'drizzle-orm';

describe('clockOut', () => {
  let schoolLocationId: number;
  let attendanceId: number;

  beforeEach(async () => {
    await createDB();
    
    // Create a test school location
    const schoolResult = await db.insert(schoolLocationsTable)
      .values({
        name: 'Test School',
        latitude: '40.7128', // New York coordinates
        longitude: '-74.0060',
        radius_meters: 100
      })
      .returning()
      .execute();
    
    schoolLocationId = schoolResult[0].id;

    // Create a test attendance record (clocked in but not clocked out)
    const attendanceResult = await db.insert(teacherAttendanceTable)
      .values({
        teacher_name: 'John Doe',
        attendance_date: '2024-01-15',
        clock_in_time: '08:00:00',
        clock_out_time: null, // Not clocked out yet
        photo_url: '/photos/john_doe_20240115.jpg',
        location_latitude: '40.7128',
        location_longitude: '-74.0060',
        school_location_id: schoolLocationId,
        is_location_valid: true
      })
      .returning()
      .execute();
    
    attendanceId = attendanceResult[0].id;
  });

  afterEach(resetDB);

  const testClockOutInput: ClockOutInput = {
    attendance_id: 0, // Will be set in each test
    clock_out_time: '17:00:00',
    location: {
      latitude: 40.7128,
      longitude: -74.0060
    }
  };

  it('should successfully clock out a teacher', async () => {
    const input = { ...testClockOutInput, attendance_id: attendanceId };
    
    const result = await clockOut(input);

    // Verify the returned result
    expect(result.id).toBe(attendanceId);
    expect(result.teacher_name).toBe('John Doe');
    expect(result.clock_in_time).toBe('08:00:00');
    expect(result.clock_out_time).toBe('17:00:00');
    expect(result.location_latitude).toBe(40.7128);
    expect(result.location_longitude).toBe(-74.0060);
    expect(result.school_location_id).toBe(schoolLocationId);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should update attendance record in database', async () => {
    const input = { ...testClockOutInput, attendance_id: attendanceId };
    
    await clockOut(input);

    // Verify the record was updated in the database
    const updatedRecord = await db.select()
      .from(teacherAttendanceTable)
      .where(eq(teacherAttendanceTable.id, attendanceId))
      .execute();

    expect(updatedRecord).toHaveLength(1);
    expect(updatedRecord[0].clock_out_time).toBe('17:00:00');
    expect(updatedRecord[0].updated_at).toBeInstanceOf(Date);
    
    // Verify original fields are unchanged
    expect(updatedRecord[0].teacher_name).toBe('John Doe');
    expect(updatedRecord[0].clock_in_time).toBe('08:00:00');
    expect(updatedRecord[0].photo_url).toBe('/photos/john_doe_20240115.jpg');
  });

  it('should handle different clock-out times', async () => {
    const input = { 
      ...testClockOutInput, 
      attendance_id: attendanceId,
      clock_out_time: '16:30:45'
    };
    
    const result = await clockOut(input);

    expect(result.clock_out_time).toBe('16:30:45');
    
    // Verify in database
    const dbRecord = await db.select()
      .from(teacherAttendanceTable)
      .where(eq(teacherAttendanceTable.id, attendanceId))
      .execute();
    
    expect(dbRecord[0].clock_out_time).toBe('16:30:45');
  });

  it('should throw error if attendance record not found', async () => {
    const input = { ...testClockOutInput, attendance_id: 999999 };
    
    await expect(clockOut(input)).rejects.toThrow(/Attendance record with ID 999999 not found/i);
  });

  it('should throw error if teacher already clocked out', async () => {
    // First clock out
    const input = { ...testClockOutInput, attendance_id: attendanceId };
    await clockOut(input);

    // Try to clock out again
    const secondClockOut = { 
      ...testClockOutInput, 
      attendance_id: attendanceId,
      clock_out_time: '18:00:00'
    };
    
    await expect(clockOut(secondClockOut)).rejects.toThrow(/Teacher has already clocked out at/i);
  });

  it('should throw error if school location not found', async () => {
    // Create attendance record with valid school location first
    const invalidAttendance = await db.insert(teacherAttendanceTable)
      .values({
        teacher_name: 'Jane Doe',
        attendance_date: '2024-01-15',
        clock_in_time: '08:00:00',
        clock_out_time: null,
        photo_url: '/photos/jane_doe.jpg',
        location_latitude: '40.7128',
        location_longitude: '-74.0060',
        school_location_id: schoolLocationId,
        is_location_valid: true
      })
      .returning()
      .execute();

    // Temporarily disable foreign key constraints, update the school_location_id, then re-enable
    await db.execute(sql`SET session_replication_role = replica`);
    await db.execute(sql`
      UPDATE teacher_attendance 
      SET school_location_id = 999999 
      WHERE id = ${invalidAttendance[0].id}
    `);
    await db.execute(sql`SET session_replication_role = default`);

    const input = { 
      ...testClockOutInput, 
      attendance_id: invalidAttendance[0].id 
    };
    
    await expect(clockOut(input)).rejects.toThrow(/School location with ID 999999 not found/i);
  });

  it('should handle location validation correctly within radius', async () => {
    // Location very close to school (within 100m radius)
    const input = {
      ...testClockOutInput,
      attendance_id: attendanceId,
      location: {
        latitude: 40.7129, // Very slight difference
        longitude: -74.0061
      }
    };
    
    const result = await clockOut(input);

    // Should succeed even though location is slightly different
    expect(result.clock_out_time).toBe('17:00:00');
    expect(result.id).toBe(attendanceId);
  });

  it('should handle numeric precision correctly', async () => {
    const input = { ...testClockOutInput, attendance_id: attendanceId };
    
    const result = await clockOut(input);

    // Verify numeric fields are returned as numbers
    expect(typeof result.location_latitude).toBe('number');
    expect(typeof result.location_longitude).toBe('number');
    expect(result.location_latitude).toBe(40.7128);
    expect(result.location_longitude).toBe(-74.0060);
  });

  it('should update the updated_at timestamp', async () => {
    // Get original timestamp
    const originalRecord = await db.select()
      .from(teacherAttendanceTable)
      .where(eq(teacherAttendanceTable.id, attendanceId))
      .execute();
    
    const originalUpdatedAt = originalRecord[0].updated_at;
    
    // Wait a small amount to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 10));
    
    const input = { ...testClockOutInput, attendance_id: attendanceId };
    const result = await clockOut(input);

    // Verify updated_at changed
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.updated_at.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
  });
});