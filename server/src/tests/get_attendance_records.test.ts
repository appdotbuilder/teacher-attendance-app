import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { teacherAttendanceTable, schoolLocationsTable } from '../db/schema';
import { type GetAttendanceQuery, type CreateSchoolLocationInput } from '../schema';
import { getAttendanceRecords } from '../handlers/get_attendance_records';

describe('getAttendanceRecords', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Helper function to create a school location
  const createSchoolLocation = async (input: CreateSchoolLocationInput) => {
    const result = await db.insert(schoolLocationsTable)
      .values({
        name: input.name,
        latitude: input.latitude.toString(),
        longitude: input.longitude.toString(),
        radius_meters: input.radius_meters,
      })
      .returning()
      .execute();
    
    return result[0];
  };

  // Helper function to create attendance record
  const createAttendanceRecord = async (data: {
    teacher_name: string;
    attendance_date: string;
    clock_in_time: string;
    clock_out_time?: string;
    photo_url: string;
    location_latitude: number;
    location_longitude: number;
    school_location_id: number;
    is_location_valid: boolean;
  }) => {
    const result = await db.insert(teacherAttendanceTable)
      .values({
        teacher_name: data.teacher_name,
        attendance_date: data.attendance_date, // Keep as string for date field
        clock_in_time: data.clock_in_time,
        clock_out_time: data.clock_out_time || null,
        photo_url: data.photo_url,
        location_latitude: data.location_latitude.toString(),
        location_longitude: data.location_longitude.toString(),
        school_location_id: data.school_location_id,
        is_location_valid: data.is_location_valid,
      })
      .returning()
      .execute();
    
    return result[0];
  };

  it('should return all attendance records when no filters are provided', async () => {
    // Create test school location
    const schoolLocation = await createSchoolLocation({
      name: 'Test Elementary School',
      latitude: 40.7128,
      longitude: -74.0060,
      radius_meters: 100,
    });

    // Create multiple attendance records
    await createAttendanceRecord({
      teacher_name: 'John Smith',
      attendance_date: '2024-01-15',
      clock_in_time: '08:00:00',
      clock_out_time: '16:00:00',
      photo_url: '/photos/john_20240115.jpg',
      location_latitude: 40.7128,
      location_longitude: -74.0060,
      school_location_id: schoolLocation.id,
      is_location_valid: true,
    });

    await createAttendanceRecord({
      teacher_name: 'Jane Doe',
      attendance_date: '2024-01-16',
      clock_in_time: '08:30:00',
      photo_url: '/photos/jane_20240116.jpg',
      location_latitude: 40.7130,
      location_longitude: -74.0058,
      school_location_id: schoolLocation.id,
      is_location_valid: true,
    });

    const results = await getAttendanceRecords();

    expect(results).toHaveLength(2);
    
    // Verify numeric conversions
    results.forEach(record => {
      expect(typeof record.location_latitude).toBe('number');
      expect(typeof record.location_longitude).toBe('number');
      expect(record.id).toBeDefined();
      expect(record.created_at).toBeInstanceOf(Date);
      expect(record.updated_at).toBeInstanceOf(Date);
    });

    // Verify ordering (most recent date first)
    expect(results[0].attendance_date).toEqual(new Date('2024-01-16'));
    expect(results[1].attendance_date).toEqual(new Date('2024-01-15'));
  });

  it('should filter by teacher name', async () => {
    const schoolLocation = await createSchoolLocation({
      name: 'Test High School',
      latitude: 40.7589,
      longitude: -73.9851,
      radius_meters: 150,
    });

    // Create records for different teachers
    await createAttendanceRecord({
      teacher_name: 'Alice Johnson',
      attendance_date: '2024-01-20',
      clock_in_time: '07:45:00',
      photo_url: '/photos/alice_20240120.jpg',
      location_latitude: 40.7589,
      location_longitude: -73.9851,
      school_location_id: schoolLocation.id,
      is_location_valid: true,
    });

    await createAttendanceRecord({
      teacher_name: 'Bob Wilson',
      attendance_date: '2024-01-20',
      clock_in_time: '08:15:00',
      photo_url: '/photos/bob_20240120.jpg',
      location_latitude: 40.7590,
      location_longitude: -73.9850,
      school_location_id: schoolLocation.id,
      is_location_valid: true,
    });

    const query: GetAttendanceQuery = {
      teacher_name: 'Alice Johnson'
    };

    const results = await getAttendanceRecords(query);

    expect(results).toHaveLength(1);
    expect(results[0].teacher_name).toBe('Alice Johnson');
    expect(results[0].clock_in_time).toBe('07:45:00');
  });

  it('should filter by date range', async () => {
    const schoolLocation = await createSchoolLocation({
      name: 'Test Middle School',
      latitude: 40.7831,
      longitude: -73.9712,
      radius_meters: 200,
    });

    // Create records across different dates
    await createAttendanceRecord({
      teacher_name: 'Carol Davis',
      attendance_date: '2024-01-10',
      clock_in_time: '08:00:00',
      photo_url: '/photos/carol_20240110.jpg',
      location_latitude: 40.7831,
      location_longitude: -73.9712,
      school_location_id: schoolLocation.id,
      is_location_valid: true,
    });

    await createAttendanceRecord({
      teacher_name: 'Carol Davis',
      attendance_date: '2024-01-15',
      clock_in_time: '08:00:00',
      photo_url: '/photos/carol_20240115.jpg',
      location_latitude: 40.7831,
      location_longitude: -73.9712,
      school_location_id: schoolLocation.id,
      is_location_valid: true,
    });

    await createAttendanceRecord({
      teacher_name: 'Carol Davis',
      attendance_date: '2024-01-25',
      clock_in_time: '08:00:00',
      photo_url: '/photos/carol_20240125.jpg',
      location_latitude: 40.7831,
      location_longitude: -73.9712,
      school_location_id: schoolLocation.id,
      is_location_valid: true,
    });

    const query: GetAttendanceQuery = {
      date_from: '2024-01-12',
      date_to: '2024-01-20'
    };

    const results = await getAttendanceRecords(query);

    expect(results).toHaveLength(1);
    expect(results[0].attendance_date).toEqual(new Date('2024-01-15'));
  });

  it('should filter by school location', async () => {
    // Create two different school locations
    const school1 = await createSchoolLocation({
      name: 'Downtown Elementary',
      latitude: 40.7128,
      longitude: -74.0060,
      radius_meters: 100,
    });

    const school2 = await createSchoolLocation({
      name: 'Uptown Elementary',
      latitude: 40.7831,
      longitude: -73.9712,
      radius_meters: 150,
    });

    // Create records for both schools
    await createAttendanceRecord({
      teacher_name: 'David Brown',
      attendance_date: '2024-01-22',
      clock_in_time: '08:00:00',
      photo_url: '/photos/david_downtown.jpg',
      location_latitude: 40.7128,
      location_longitude: -74.0060,
      school_location_id: school1.id,
      is_location_valid: true,
    });

    await createAttendanceRecord({
      teacher_name: 'Eva Martinez',
      attendance_date: '2024-01-22',
      clock_in_time: '08:00:00',
      photo_url: '/photos/eva_uptown.jpg',
      location_latitude: 40.7831,
      location_longitude: -73.9712,
      school_location_id: school2.id,
      is_location_valid: true,
    });

    const query: GetAttendanceQuery = {
      school_location_id: school2.id
    };

    const results = await getAttendanceRecords(query);

    expect(results).toHaveLength(1);
    expect(results[0].teacher_name).toBe('Eva Martinez');
    expect(results[0].school_location_id).toBe(school2.id);
  });

  it('should handle multiple filters combined', async () => {
    const schoolLocation = await createSchoolLocation({
      name: 'Combined Filter Test School',
      latitude: 40.7505,
      longitude: -73.9934,
      radius_meters: 120,
    });

    // Create multiple records with different combinations
    await createAttendanceRecord({
      teacher_name: 'Frank Wilson',
      attendance_date: '2024-02-10',
      clock_in_time: '07:30:00',
      photo_url: '/photos/frank_20240210.jpg',
      location_latitude: 40.7505,
      location_longitude: -73.9934,
      school_location_id: schoolLocation.id,
      is_location_valid: true,
    });

    await createAttendanceRecord({
      teacher_name: 'Frank Wilson',
      attendance_date: '2024-02-05',
      clock_in_time: '08:00:00',
      photo_url: '/photos/frank_20240205.jpg',
      location_latitude: 40.7505,
      location_longitude: -73.9934,
      school_location_id: schoolLocation.id,
      is_location_valid: false,
    });

    await createAttendanceRecord({
      teacher_name: 'Grace Lee',
      attendance_date: '2024-02-12',
      clock_in_time: '08:15:00',
      photo_url: '/photos/grace_20240212.jpg',
      location_latitude: 40.7505,
      location_longitude: -73.9934,
      school_location_id: schoolLocation.id,
      is_location_valid: true,
    });

    const query: GetAttendanceQuery = {
      teacher_name: 'Frank Wilson',
      date_from: '2024-02-08',
      date_to: '2024-02-15',
      school_location_id: schoolLocation.id
    };

    const results = await getAttendanceRecords(query);

    expect(results).toHaveLength(1);
    expect(results[0].teacher_name).toBe('Frank Wilson');
    expect(results[0].attendance_date).toEqual(new Date('2024-02-10'));
    expect(results[0].is_location_valid).toBe(true);
  });

  it('should return empty array when no records match filters', async () => {
    const schoolLocation = await createSchoolLocation({
      name: 'Empty Results School',
      latitude: 40.7400,
      longitude: -74.0000,
      radius_meters: 100,
    });

    await createAttendanceRecord({
      teacher_name: 'Henry Adams',
      attendance_date: '2024-03-01',
      clock_in_time: '08:00:00',
      photo_url: '/photos/henry_20240301.jpg',
      location_latitude: 40.7400,
      location_longitude: -74.0000,
      school_location_id: schoolLocation.id,
      is_location_valid: true,
    });

    const query: GetAttendanceQuery = {
      teacher_name: 'NonExistent Teacher'
    };

    const results = await getAttendanceRecords(query);

    expect(results).toHaveLength(0);
  });

  it('should handle records without clock_out_time (still actively working)', async () => {
    const schoolLocation = await createSchoolLocation({
      name: 'Active Work School',
      latitude: 40.7200,
      longitude: -74.0100,
      radius_meters: 100,
    });

    await createAttendanceRecord({
      teacher_name: 'Iris Parker',
      attendance_date: '2024-03-05',
      clock_in_time: '08:00:00',
      // No clock_out_time - still working
      photo_url: '/photos/iris_20240305.jpg',
      location_latitude: 40.7200,
      location_longitude: -74.0100,
      school_location_id: schoolLocation.id,
      is_location_valid: true,
    });

    const results = await getAttendanceRecords();

    expect(results).toHaveLength(1);
    expect(results[0].teacher_name).toBe('Iris Parker');
    expect(results[0].clock_in_time).toBe('08:00:00');
    expect(results[0].clock_out_time).toBeNull();
  });

  it('should properly order results by date and time (most recent first)', async () => {
    const schoolLocation = await createSchoolLocation({
      name: 'Ordering Test School',
      latitude: 40.7300,
      longitude: -74.0200,
      radius_meters: 100,
    });

    // Create records in different order than expected result
    await createAttendanceRecord({
      teacher_name: 'Jack Thompson',
      attendance_date: '2024-03-10',
      clock_in_time: '07:30:00',
      photo_url: '/photos/jack_early.jpg',
      location_latitude: 40.7300,
      location_longitude: -74.0200,
      school_location_id: schoolLocation.id,
      is_location_valid: true,
    });

    await createAttendanceRecord({
      teacher_name: 'Kate Rodriguez',
      attendance_date: '2024-03-12',
      clock_in_time: '08:00:00',
      photo_url: '/photos/kate_latest.jpg',
      location_latitude: 40.7300,
      location_longitude: -74.0200,
      school_location_id: schoolLocation.id,
      is_location_valid: true,
    });

    await createAttendanceRecord({
      teacher_name: 'Leo Garcia',
      attendance_date: '2024-03-10',
      clock_in_time: '08:30:00',
      photo_url: '/photos/leo_late.jpg',
      location_latitude: 40.7300,
      location_longitude: -74.0200,
      school_location_id: schoolLocation.id,
      is_location_valid: true,
    });

    const results = await getAttendanceRecords();

    expect(results).toHaveLength(3);
    
    // Should be ordered by date (desc), then time (desc)
    expect(results[0].attendance_date).toEqual(new Date('2024-03-12')); // Most recent date
    expect(results[0].teacher_name).toBe('Kate Rodriguez');
    
    expect(results[1].attendance_date).toEqual(new Date('2024-03-10')); // Same date, later time
    expect(results[1].clock_in_time).toBe('08:30:00');
    expect(results[1].teacher_name).toBe('Leo Garcia');
    
    expect(results[2].attendance_date).toEqual(new Date('2024-03-10')); // Same date, earlier time
    expect(results[2].clock_in_time).toBe('07:30:00');
    expect(results[2].teacher_name).toBe('Jack Thompson');
  });
});