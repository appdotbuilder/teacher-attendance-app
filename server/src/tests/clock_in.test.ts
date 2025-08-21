import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { schoolLocationsTable, teacherAttendanceTable } from '../db/schema';
import { type ClockInInput } from '../schema';
import { clockIn } from '../handlers/clock_in';
import { eq } from 'drizzle-orm';

describe('clockIn', () => {
  let testSchoolLocationId: number;

  beforeEach(async () => {
    await createDB();
    
    // Create a test school location first
    const schoolLocationResult = await db.insert(schoolLocationsTable)
      .values({
        name: 'Test School',
        latitude: '40.123456',
        longitude: '-74.123456',
        radius_meters: 100
      })
      .returning()
      .execute();
    
    testSchoolLocationId = schoolLocationResult[0].id;
  });

  afterEach(resetDB);

  const createValidClockInInput = (overrides: Partial<ClockInInput> = {}): ClockInInput => ({
    teacher_name: 'John Doe',
    attendance_date: '2024-01-15',
    clock_in_time: '08:30:00',
    photo_url: 'https://example.com/photo.jpg',
    location: {
      latitude: 40.123456, // Same as school location
      longitude: -74.123456
    },
    school_location_id: testSchoolLocationId,
    ...overrides
  });

  it('should create attendance record for valid location', async () => {
    const input = createValidClockInInput();
    
    const result = await clockIn(input);

    // Validate return values
    expect(result.id).toBeDefined();
    expect(result.teacher_name).toBe('John Doe');
    expect(result.attendance_date).toBeInstanceOf(Date);
    expect(result.clock_in_time).toBe('08:30:00');
    expect(result.clock_out_time).toBeNull();
    expect(result.photo_url).toBe('https://example.com/photo.jpg');
    expect(result.location_latitude).toBe(40.123456);
    expect(result.location_longitude).toBe(-74.123456);
    expect(result.school_location_id).toBe(testSchoolLocationId);
    expect(result.is_location_valid).toBe(true);
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);

    // Validate numeric type conversions
    expect(typeof result.location_latitude).toBe('number');
    expect(typeof result.location_longitude).toBe('number');
  });

  it('should save attendance record to database', async () => {
    const input = createValidClockInInput();
    
    const result = await clockIn(input);

    // Query database to verify record was saved
    const savedRecords = await db.select()
      .from(teacherAttendanceTable)
      .where(eq(teacherAttendanceTable.id, result.id))
      .execute();

    expect(savedRecords).toHaveLength(1);
    const savedRecord = savedRecords[0];
    
    expect(savedRecord.teacher_name).toBe('John Doe');
    expect(savedRecord.attendance_date).toBe('2024-01-15');
    expect(savedRecord.clock_in_time).toBe('08:30:00');
    expect(savedRecord.clock_out_time).toBeNull();
    expect(savedRecord.photo_url).toBe('https://example.com/photo.jpg');
    expect(parseFloat(savedRecord.location_latitude)).toBe(40.123456);
    expect(parseFloat(savedRecord.location_longitude)).toBe(-74.123456);
    expect(savedRecord.school_location_id).toBe(testSchoolLocationId);
    expect(savedRecord.is_location_valid).toBe(true);
  });

  it('should mark location as invalid when outside radius', async () => {
    const input = createValidClockInInput({
      location: {
        latitude: 40.125000, // About 200m away from school location
        longitude: -74.125000
      }
    });
    
    const result = await clockIn(input);

    expect(result.is_location_valid).toBe(false);
    expect(result.location_latitude).toBe(40.125000);
    expect(result.location_longitude).toBe(-74.125000);
  });

  it('should mark location as valid when within radius', async () => {
    const input = createValidClockInInput({
      location: {
        latitude: 40.123500, // About 50m away from school location
        longitude: -74.123500
      }
    });
    
    const result = await clockIn(input);

    expect(result.is_location_valid).toBe(true);
    expect(result.location_latitude).toBe(40.123500);
    expect(result.location_longitude).toBe(-74.123500);
  });

  it('should handle different school location with different radius', async () => {
    // Create another school with larger radius
    const largeRadiusSchoolResult = await db.insert(schoolLocationsTable)
      .values({
        name: 'Large School',
        latitude: '41.000000',
        longitude: '-75.000000',
        radius_meters: 500 // Larger radius
      })
      .returning()
      .execute();

    const input = createValidClockInInput({
      school_location_id: largeRadiusSchoolResult[0].id,
      location: {
        latitude: 41.002000, // About 250m away - within 500m radius
        longitude: -75.002000
      }
    });
    
    const result = await clockIn(input);

    expect(result.is_location_valid).toBe(true);
    expect(result.school_location_id).toBe(largeRadiusSchoolResult[0].id);
  });

  it('should throw error for non-existent school location', async () => {
    const input = createValidClockInInput({
      school_location_id: 99999 // Non-existent ID
    });

    expect(clockIn(input)).rejects.toThrow(/School location with ID 99999 not found/);
  });

  it('should handle edge case coordinates correctly', async () => {
    // Create school at edge coordinates
    const edgeSchoolResult = await db.insert(schoolLocationsTable)
      .values({
        name: 'Edge School',
        latitude: '89.999999', // Near north pole
        longitude: '179.999999', // Near date line
        radius_meters: 1000
      })
      .returning()
      .execute();

    const input = createValidClockInInput({
      school_location_id: edgeSchoolResult[0].id,
      location: {
        latitude: 89.999999,
        longitude: 179.999999
      }
    });
    
    const result = await clockIn(input);

    expect(result.is_location_valid).toBe(true);
    expect(result.location_latitude).toBe(89.999999);
    expect(result.location_longitude).toBe(179.999999);
  });

  it('should handle different time formats correctly', async () => {
    const input = createValidClockInInput({
      clock_in_time: '23:59:59' // Late time
    });
    
    const result = await clockIn(input);

    expect(result.clock_in_time).toBe('23:59:59');
    
    // Verify in database
    const savedRecords = await db.select()
      .from(teacherAttendanceTable)
      .where(eq(teacherAttendanceTable.id, result.id))
      .execute();
    
    expect(savedRecords[0].clock_in_time).toBe('23:59:59');
  });

  it('should handle date string conversion correctly', async () => {
    const input = createValidClockInInput({
      attendance_date: '2024-12-31'
    });
    
    const result = await clockIn(input);

    expect(result.attendance_date).toBeInstanceOf(Date);
    expect(result.attendance_date.getFullYear()).toBe(2024);
    expect(result.attendance_date.getMonth()).toBe(11); // December is month 11
    expect(result.attendance_date.getDate()).toBe(31);
  });
});