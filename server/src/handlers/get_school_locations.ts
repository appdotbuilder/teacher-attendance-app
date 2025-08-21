import { db } from '../db';
import { schoolLocationsTable } from '../db/schema';
import { asc } from 'drizzle-orm';
import { type SchoolLocation } from '../schema';

/**
 * Retrieves all available school locations.
 * This handler provides a list of predefined school locations that teachers
 * can select from when recording attendance.
 */
export async function getSchoolLocations(): Promise<SchoolLocation[]> {
  try {
    // Fetch all school locations sorted by name
    const results = await db.select()
      .from(schoolLocationsTable)
      .orderBy(asc(schoolLocationsTable.name))
      .execute();

    // Convert numeric fields from strings to numbers
    return results.map(location => ({
      ...location,
      latitude: parseFloat(location.latitude), // Convert numeric to number
      longitude: parseFloat(location.longitude) // Convert numeric to number
    }));
  } catch (error) {
    console.error('Failed to get school locations:', error);
    throw error;
  }
}