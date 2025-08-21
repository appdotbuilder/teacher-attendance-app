import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { schoolLocationsTable } from '../db/schema';
import { type Location } from '../schema';
import { validateLocation } from '../handlers/validate_location';

// Test data
const testSchoolLocation = {
  name: 'Test School',
  latitude: '40.7128', // NYC coordinates as string for database
  longitude: '-74.0060',
  radius_meters: 100 // 100 meter radius
};

const nycLocation: Location = {
  latitude: 40.7128,
  longitude: -74.0060
};

// Location within 50 meters of NYC coordinates
const nearbyLocation: Location = {
  latitude: 40.7132, // About 44 meters north
  longitude: -74.0060
};

// Location about 500 meters away from NYC coordinates
const farLocation: Location = {
  latitude: 40.7173, // About 500 meters north
  longitude: -74.0060
};

describe('validateLocation', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should validate location within radius', async () => {
    // Create test school location
    const schoolResults = await db.insert(schoolLocationsTable)
      .values(testSchoolLocation)
      .returning()
      .execute();
    
    const schoolId = schoolResults[0].id;

    // Test location exactly at school coordinates
    const result = await validateLocation(nycLocation, schoolId);

    expect(result.is_valid).toBe(true);
    expect(result.distance_meters).toBe(0);
    expect(result.school_location.id).toBe(schoolId);
    expect(result.school_location.name).toBe('Test School');
    expect(result.school_location.latitude).toBe(40.7128);
    expect(result.school_location.longitude).toBe(-74.0060);
    expect(result.school_location.radius_meters).toBe(100);
  });

  it('should validate location within allowed radius', async () => {
    // Create test school location
    const schoolResults = await db.insert(schoolLocationsTable)
      .values(testSchoolLocation)
      .returning()
      .execute();
    
    const schoolId = schoolResults[0].id;

    // Test nearby location (should be within 100m radius)
    const result = await validateLocation(nearbyLocation, schoolId);

    expect(result.is_valid).toBe(true);
    expect(result.distance_meters).toBeGreaterThan(0);
    expect(result.distance_meters).toBeLessThanOrEqual(100);
    expect(result.school_location.id).toBe(schoolId);
  });

  it('should invalidate location outside radius', async () => {
    // Create test school location with small radius
    const smallRadiusSchool = {
      ...testSchoolLocation,
      radius_meters: 50 // Small radius for testing
    };

    const schoolResults = await db.insert(schoolLocationsTable)
      .values(smallRadiusSchool)
      .returning()
      .execute();
    
    const schoolId = schoolResults[0].id;

    // Test far location (should be outside 50m radius)
    const result = await validateLocation(farLocation, schoolId);

    expect(result.is_valid).toBe(false);
    expect(result.distance_meters).toBeGreaterThan(50);
    expect(result.school_location.id).toBe(schoolId);
    expect(result.school_location.radius_meters).toBe(50);
  });

  it('should calculate correct distance using Haversine formula', async () => {
    // Create test school location
    const schoolResults = await db.insert(schoolLocationsTable)
      .values(testSchoolLocation)
      .returning()
      .execute();
    
    const schoolId = schoolResults[0].id;

    // Test with known coordinates that should give predictable distance
    const testLocation: Location = {
      latitude: 40.7138, // About 111 meters north (approximately 1 minute of latitude)
      longitude: -74.0060
    };

    const result = await validateLocation(testLocation, schoolId);

    // Distance should be approximately 111 meters (1 minute of latitude at NYC coordinates)
    expect(result.distance_meters).toBeGreaterThan(100);
    expect(result.distance_meters).toBeLessThan(120);
    expect(result.is_valid).toBe(false); // Should be outside 100m radius
  });

  it('should handle exact boundary cases', async () => {
    // Create school location with 100m radius
    const schoolResults = await db.insert(schoolLocationsTable)
      .values(testSchoolLocation)
      .returning()
      .execute();
    
    const schoolId = schoolResults[0].id;

    // Location approximately 100 meters away (should be at boundary)
    const boundaryLocation: Location = {
      latitude: 40.7137, // Approximately 100 meters north
      longitude: -74.0060
    };

    const result = await validateLocation(boundaryLocation, schoolId);

    // Should be right at or very close to the boundary
    expect(result.distance_meters).toBeGreaterThan(95);
    expect(result.distance_meters).toBeLessThanOrEqual(105);
    
    // Validation depends on exact calculated distance
    if (result.distance_meters <= 100) {
      expect(result.is_valid).toBe(true);
    } else {
      expect(result.is_valid).toBe(false);
    }
  });

  it('should throw error for non-existent school location', async () => {
    const nonExistentId = 99999;

    await expect(validateLocation(nycLocation, nonExistentId))
      .rejects.toThrow(/School location with ID 99999 not found/i);
  });

  it('should handle different coordinate precision', async () => {
    // Create school with high precision coordinates
    const preciseSchool = {
      name: 'Precise School',
      latitude: '40.71280000', // High precision
      longitude: '-74.00600000',
      radius_meters: 50
    };

    const schoolResults = await db.insert(schoolLocationsTable)
      .values(preciseSchool)
      .returning()
      .execute();
    
    const schoolId = schoolResults[0].id;

    // Test with slightly different precision
    const testLocation: Location = {
      latitude: 40.7128, // Same coordinates but different precision
      longitude: -74.0060
    };

    const result = await validateLocation(testLocation, schoolId);

    expect(result.is_valid).toBe(true);
    expect(result.distance_meters).toBe(0);
  });

  it('should validate numeric field conversions correctly', async () => {
    // Create test school location
    const schoolResults = await db.insert(schoolLocationsTable)
      .values(testSchoolLocation)
      .returning()
      .execute();
    
    const schoolId = schoolResults[0].id;

    const result = await validateLocation(nycLocation, schoolId);

    // Verify that latitude and longitude are returned as numbers, not strings
    expect(typeof result.school_location.latitude).toBe('number');
    expect(typeof result.school_location.longitude).toBe('number');
    expect(typeof result.school_location.radius_meters).toBe('number');
    expect(typeof result.distance_meters).toBe('number');
  });
});