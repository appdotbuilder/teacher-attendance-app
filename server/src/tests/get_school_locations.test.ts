import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { schoolLocationsTable } from '../db/schema';
import { getSchoolLocations } from '../handlers/get_school_locations';

describe('getSchoolLocations', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no school locations exist', async () => {
    const result = await getSchoolLocations();
    
    expect(result).toEqual([]);
    expect(Array.isArray(result)).toBe(true);
  });

  it('should return all school locations', async () => {
    // Create test school locations
    await db.insert(schoolLocationsTable)
      .values([
        {
          name: 'Main Campus',
          latitude: '40.7128',
          longitude: '-74.0060',
          radius_meters: 100
        },
        {
          name: 'North Branch',
          latitude: '40.7589',
          longitude: '-73.9851',
          radius_meters: 150
        }
      ])
      .execute();

    const result = await getSchoolLocations();

    expect(result).toHaveLength(2);
    
    // Check first location (sorted by name)
    const mainCampus = result[0];
    expect(mainCampus.name).toEqual('Main Campus');
    expect(mainCampus.latitude).toEqual(40.7128);
    expect(mainCampus.longitude).toEqual(-74.0060);
    expect(mainCampus.radius_meters).toEqual(100);
    expect(mainCampus.id).toBeDefined();
    expect(mainCampus.created_at).toBeInstanceOf(Date);
    
    // Verify numeric type conversion
    expect(typeof mainCampus.latitude).toBe('number');
    expect(typeof mainCampus.longitude).toBe('number');
    expect(typeof mainCampus.radius_meters).toBe('number');
  });

  it('should return locations sorted by name', async () => {
    // Create test school locations with names that will test sorting
    await db.insert(schoolLocationsTable)
      .values([
        {
          name: 'Zulu Campus',
          latitude: '40.7128',
          longitude: '-74.0060',
          radius_meters: 100
        },
        {
          name: 'Alpha Campus',
          latitude: '40.7589',
          longitude: '-73.9851',
          radius_meters: 150
        },
        {
          name: 'Bravo Campus',
          latitude: '40.7831',
          longitude: '-73.9712',
          radius_meters: 200
        }
      ])
      .execute();

    const result = await getSchoolLocations();

    expect(result).toHaveLength(3);
    expect(result[0].name).toEqual('Alpha Campus');
    expect(result[1].name).toEqual('Bravo Campus');
    expect(result[2].name).toEqual('Zulu Campus');
  });

  it('should handle high precision GPS coordinates correctly', async () => {
    // Test with high precision coordinates
    await db.insert(schoolLocationsTable)
      .values({
        name: 'Precision Campus',
        latitude: '40.71280123', // 8 decimal places
        longitude: '-74.00601234', // 8 decimal places
        radius_meters: 75
      })
      .execute();

    const result = await getSchoolLocations();

    expect(result).toHaveLength(1);
    expect(result[0].latitude).toEqual(40.71280123);
    expect(result[0].longitude).toEqual(-74.00601234);
    expect(typeof result[0].latitude).toBe('number');
    expect(typeof result[0].longitude).toBe('number');
  });

  it('should include all required fields', async () => {
    await db.insert(schoolLocationsTable)
      .values({
        name: 'Test Campus',
        latitude: '40.7128',
        longitude: '-74.0060',
        radius_meters: 200
      })
      .execute();

    const result = await getSchoolLocations();
    const location = result[0];

    // Verify all required schema fields are present
    expect(location).toHaveProperty('id');
    expect(location).toHaveProperty('name');
    expect(location).toHaveProperty('latitude');
    expect(location).toHaveProperty('longitude');
    expect(location).toHaveProperty('radius_meters');
    expect(location).toHaveProperty('created_at');
    
    // Verify field types
    expect(typeof location.id).toBe('number');
    expect(typeof location.name).toBe('string');
    expect(typeof location.latitude).toBe('number');
    expect(typeof location.longitude).toBe('number');
    expect(typeof location.radius_meters).toBe('number');
    expect(location.created_at).toBeInstanceOf(Date);
  });

  it('should handle different radius values correctly', async () => {
    await db.insert(schoolLocationsTable)
      .values([
        {
          name: 'Small Radius',
          latitude: '40.7128',
          longitude: '-74.0060',
          radius_meters: 50
        },
        {
          name: 'Large Radius', 
          latitude: '40.7589',
          longitude: '-73.9851',
          radius_meters: 500
        }
      ])
      .execute();

    const result = await getSchoolLocations();

    expect(result).toHaveLength(2);
    
    const largeRadius = result.find(loc => loc.name === 'Large Radius');
    const smallRadius = result.find(loc => loc.name === 'Small Radius');
    
    expect(largeRadius?.radius_meters).toEqual(500);
    expect(smallRadius?.radius_meters).toEqual(50);
  });
});