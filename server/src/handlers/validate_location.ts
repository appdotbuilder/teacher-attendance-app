import { db } from '../db';
import { schoolLocationsTable } from '../db/schema';
import { type Location, type LocationValidation } from '../schema';
import { eq } from 'drizzle-orm';

/**
 * Calculates the distance between two GPS coordinates using the Haversine formula.
 * Returns the distance in meters.
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180; // φ, λ in radians
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  const distance = R * c; // Distance in meters
  return Math.round(distance);
}

/**
 * Validates if a given location is within the allowed radius of a school location.
 * Uses the Haversine formula to calculate distance between two GPS coordinates.
 * This handler checks if the teacher is within the predefined school boundary.
 */
export async function validateLocation(
  teacherLocation: Location, 
  schoolLocationId: number
): Promise<LocationValidation> {
  try {
    // 1. Fetch school location from database by ID
    const schoolLocationResults = await db.select()
      .from(schoolLocationsTable)
      .where(eq(schoolLocationsTable.id, schoolLocationId))
      .execute();

    if (schoolLocationResults.length === 0) {
      throw new Error(`School location with ID ${schoolLocationId} not found`);
    }

    const schoolLocationData = schoolLocationResults[0];

    // Convert numeric fields back to numbers
    const schoolLocation = {
      ...schoolLocationData,
      latitude: parseFloat(schoolLocationData.latitude),
      longitude: parseFloat(schoolLocationData.longitude)
    };

    // 2. Calculate distance between teacher location and school location using Haversine formula
    const distanceMeters = calculateDistance(
      teacherLocation.latitude,
      teacherLocation.longitude,
      schoolLocation.latitude,
      schoolLocation.longitude
    );

    // 3. Check if distance is within allowed radius
    const isValid = distanceMeters <= schoolLocation.radius_meters;

    // 4. Return validation result with distance and school location details
    return {
      is_valid: isValid,
      distance_meters: distanceMeters,
      school_location: schoolLocation
    };
  } catch (error) {
    console.error('Location validation failed:', error);
    throw error;
  }
}