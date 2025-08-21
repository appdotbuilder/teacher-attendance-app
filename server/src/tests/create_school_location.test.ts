import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { schoolLocationsTable } from '../db/schema';
import { type CreateSchoolLocationInput } from '../schema';
import { createSchoolLocation } from '../handlers/create_school_location';
import { eq } from 'drizzle-orm';

// Test input with all required fields
const testInput: CreateSchoolLocationInput = {
  name: 'Test Elementary School',
  latitude: 40.7128,
  longitude: -74.0060,
  radius_meters: 150
};

// Test input with minimal fields (using default radius)
const testInputMinimal: CreateSchoolLocationInput = {
  name: 'Another School',
  latitude: 34.0522,
  longitude: -118.2437,
  radius_meters: 100 // Explicitly provide default value for test
};

describe('createSchoolLocation', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a school location with all fields', async () => {
    const result = await createSchoolLocation(testInput);

    // Basic field validation
    expect(result.name).toEqual('Test Elementary School');
    expect(result.latitude).toEqual(40.7128);
    expect(result.longitude).toEqual(-74.0060);
    expect(result.radius_meters).toEqual(150);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);

    // Verify numeric types
    expect(typeof result.latitude).toBe('number');
    expect(typeof result.longitude).toBe('number');
    expect(typeof result.radius_meters).toBe('number');
  });

  it('should handle minimal input correctly', async () => {
    const result = await createSchoolLocation(testInputMinimal);

    expect(result.name).toEqual('Another School');
    expect(result.latitude).toEqual(34.0522);
    expect(result.longitude).toEqual(-118.2437);
    expect(result.radius_meters).toEqual(100); // Default value
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should save school location to database', async () => {
    const result = await createSchoolLocation(testInput);

    // Query using proper drizzle syntax
    const locations = await db.select()
      .from(schoolLocationsTable)
      .where(eq(schoolLocationsTable.id, result.id))
      .execute();

    expect(locations).toHaveLength(1);
    expect(locations[0].name).toEqual('Test Elementary School');
    
    // Verify database storage (stored as strings, need to parse)
    expect(parseFloat(locations[0].latitude)).toEqual(40.7128);
    expect(parseFloat(locations[0].longitude)).toEqual(-74.0060);
    expect(locations[0].radius_meters).toEqual(150);
    expect(locations[0].created_at).toBeInstanceOf(Date);
  });

  it('should handle boundary GPS coordinates', async () => {
    // Test with extreme valid coordinates
    const boundaryInput: CreateSchoolLocationInput = {
      name: 'Boundary School',
      latitude: 90, // Maximum latitude
      longitude: -180, // Minimum longitude  
      radius_meters: 50
    };

    const result = await createSchoolLocation(boundaryInput);

    expect(result.latitude).toEqual(90);
    expect(result.longitude).toEqual(-180);
    expect(result.radius_meters).toEqual(50);
    
    // Verify saved to database correctly
    const locations = await db.select()
      .from(schoolLocationsTable)
      .where(eq(schoolLocationsTable.id, result.id))
      .execute();

    expect(parseFloat(locations[0].latitude)).toEqual(90);
    expect(parseFloat(locations[0].longitude)).toEqual(-180);
  });

  it('should handle high precision coordinates', async () => {
    // Test with high precision GPS coordinates
    const precisionInput: CreateSchoolLocationInput = {
      name: 'Precision School',
      latitude: 37.4221994, // High precision latitude
      longitude: -122.0844288, // High precision longitude
      radius_meters: 200
    };

    const result = await createSchoolLocation(precisionInput);

    expect(result.latitude).toEqual(37.4221994);
    expect(result.longitude).toEqual(-122.0844288);
    
    // Verify precision is maintained in database
    const locations = await db.select()
      .from(schoolLocationsTable)
      .where(eq(schoolLocationsTable.id, result.id))
      .execute();

    expect(parseFloat(locations[0].latitude)).toEqual(37.4221994);
    expect(parseFloat(locations[0].longitude)).toEqual(-122.0844288);
  });

  it('should create multiple school locations', async () => {
    // Create first location
    const result1 = await createSchoolLocation({
      name: 'School One',
      latitude: 40.7128,
      longitude: -74.0060,
      radius_meters: 100
    });

    // Create second location
    const result2 = await createSchoolLocation({
      name: 'School Two', 
      latitude: 34.0522,
      longitude: -118.2437,
      radius_meters: 200
    });

    // Verify both locations exist with different IDs
    expect(result1.id).not.toEqual(result2.id);
    expect(result1.name).toEqual('School One');
    expect(result2.name).toEqual('School Two');

    // Query all locations
    const allLocations = await db.select()
      .from(schoolLocationsTable)
      .execute();

    expect(allLocations).toHaveLength(2);
  });
});