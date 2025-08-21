import { db } from '../db';
import { schoolLocationsTable } from '../db/schema';
import { type CreateSchoolLocationInput, type SchoolLocation } from '../schema';

/**
 * Creates a new school location with GPS coordinates and validation radius.
 * This handler allows administrators to set up predefined school locations
 * that teachers must be within when clocking in/out.
 */
export const createSchoolLocation = async (input: CreateSchoolLocationInput): Promise<SchoolLocation> => {
  try {
    // Insert school location record
    const result = await db.insert(schoolLocationsTable)
      .values({
        name: input.name,
        latitude: input.latitude.toString(), // Convert number to string for numeric column
        longitude: input.longitude.toString(), // Convert number to string for numeric column
        radius_meters: input.radius_meters ?? 100 // Use default if undefined
      })
      .returning()
      .execute();

    // Convert numeric fields back to numbers before returning
    const schoolLocation = result[0];
    return {
      ...schoolLocation,
      latitude: parseFloat(schoolLocation.latitude), // Convert string back to number
      longitude: parseFloat(schoolLocation.longitude) // Convert string back to number
    };
  } catch (error) {
    console.error('School location creation failed:', error);
    throw error;
  }
};