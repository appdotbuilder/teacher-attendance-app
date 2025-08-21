import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  MapPin, 
  Plus, 
  Loader2, 
  AlertTriangle, 
  CheckCircle, 
  Edit,
  Trash2,
  Globe
} from 'lucide-react';
import { trpc } from '@/utils/trpc';
import type { SchoolLocation, CreateSchoolLocationInput } from '../../../server/src/schema';

interface SchoolLocationManagerProps {
  locations: SchoolLocation[];
  onNewLocation: (location: SchoolLocation) => void;
  isLoading: boolean;
}

export function SchoolLocationManager({ locations, onNewLocation, isLoading }: SchoolLocationManagerProps) {
  const [formData, setFormData] = useState<CreateSchoolLocationInput>({
    name: '',
    latitude: 0,
    longitude: 0,
    radius_meters: 100,
  });

  const [currentLocation, setCurrentLocation] = useState<{latitude: number; longitude: number} | null>(null);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Get current GPS location
  const getCurrentLocation = useCallback(() => {
    setLocationStatus('loading');
    setError(null);
    
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser.');
      setLocationStatus('error');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        };
        setCurrentLocation(coords);
        setFormData(prev => ({
          ...prev,
          latitude: coords.latitude,
          longitude: coords.longitude
        }));
        setLocationStatus('success');
      },
      (error) => {
        setError(`Location error: ${error.message}`);
        setLocationStatus('error');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    );
  }, []);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!formData.name.trim()) {
      setError('Please enter a school name');
      return;
    }

    if (formData.latitude === 0 || formData.longitude === 0) {
      setError('Please set valid coordinates');
      return;
    }

    setIsSubmitting(true);
    
    try {
      const result = await trpc.createSchoolLocation.mutate(formData);
      onNewLocation(result);

      // Reset form
      setFormData({
        name: '',
        latitude: 0,
        longitude: 0,
        radius_meters: 100,
      });
      setCurrentLocation(null);
      setLocationStatus('idle');
      setShowForm(false);

    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to create school location');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Generate Google Maps link
  const getMapsLink = (latitude: number, longitude: number) => {
    return `https://www.google.com/maps?q=${latitude},${longitude}`;
  };

  return (
    <div className="space-y-6">
      {/* Add New Location Button */}
      {!showForm && (
        <div className="text-center">
          <Button 
            onClick={() => setShowForm(true)}
            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
            size="lg"
          >
            <Plus className="h-5 w-5 mr-2" />
            🏫 Add New School Location
          </Button>
        </div>
      )}

      {/* Add Location Form */}
      {showForm && (
        <Card className="border-2 border-dashed border-blue-300 bg-blue-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              🏫 Create New School Location
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* School Name */}
              <div className="space-y-2">
                <Label htmlFor="school_name">🏫 School Name</Label>
                <Input
                  id="school_name"
                  value={formData.name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormData(prev => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="Enter school name (e.g., Lincoln Elementary School)"
                  required
                />
              </div>

              {/* Location Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>📍 GPS Coordinates</Label>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={getCurrentLocation}
                    disabled={locationStatus === 'loading'}
                  >
                    {locationStatus === 'loading' && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    <MapPin className="h-4 w-4 mr-2" />
                    {locationStatus === 'loading' ? 'Getting Location...' : 'Use Current Location'}
                  </Button>
                </div>

                {locationStatus === 'success' && currentLocation && (
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>
                      ✅ Location obtained successfully! Coordinates have been filled in below.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="latitude">🌐 Latitude</Label>
                    <Input
                      id="latitude"
                      type="number"
                      step="any"
                      value={formData.latitude}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setFormData(prev => ({ ...prev, latitude: parseFloat(e.target.value) || 0 }))
                      }
                      placeholder="e.g., 40.7128"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="longitude">🌐 Longitude</Label>
                    <Input
                      id="longitude"
                      type="number"
                      step="any"
                      value={formData.longitude}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setFormData(prev => ({ ...prev, longitude: parseFloat(e.target.value) || 0 }))
                      }
                      placeholder="e.g., -74.0060"
                      required
                    />
                  </div>
                </div>

                {/* Preview Maps Link */}
                {formData.latitude !== 0 && formData.longitude !== 0 && (
                  <div className="text-center">
                    <a 
                      href={getMapsLink(formData.latitude, formData.longitude)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 text-sm flex items-center justify-center gap-1"
                    >
                      <Globe className="h-3 w-3" />
                      🗺️ Preview location on Google Maps
                    </a>
                  </div>
                )}
              </div>

              {/* Validation Radius */}
              <div className="space-y-2">
                <Label htmlFor="radius">🎯 Validation Radius (meters)</Label>
                <Input
                  id="radius"
                  type="number"
                  min="10"
                  max="1000"
                  value={formData.radius_meters}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormData(prev => ({ ...prev, radius_meters: parseInt(e.target.value) || 100 }))
                  }
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Teachers must be within this radius to clock in/out. Recommended: 50-200 meters.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button 
                  type="submit" 
                  disabled={isSubmitting || isLoading}
                  className="flex-1"
                >
                  {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  <Plus className="h-4 w-4 mr-2" />
                  {isSubmitting ? 'Creating...' : 'Create Location'}
                </Button>
                
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={() => {
                    setShowForm(false);
                    setError(null);
                    setLocationStatus('idle');
                    setCurrentLocation(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Existing Locations */}
      <div>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          🏫 School Locations ({locations.length})
        </h3>
        
        {locations.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="text-center py-12">
              <MapPin className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h4 className="text-lg font-semibold text-gray-600 mb-2">No School Locations</h4>
              <p className="text-gray-500 mb-6">
                Add your first school location to enable GPS-based attendance tracking! 🎯
              </p>
              <div className="text-4xl mb-4">🏫</div>
              <p className="text-sm text-muted-foreground">
                Teachers will need to be within the specified radius of a school location to record attendance.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {locations.map((location: SchoolLocation) => (
              <Card key={location.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h4 className="text-lg font-semibold flex items-center gap-2">
                        🏫 {location.name}
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        Created: {new Date(location.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    
                    <div className="flex gap-2">
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        📍 Active
                      </Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">🌐 Coordinates</p>
                      <p className="font-mono">
                        {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                      </p>
                    </div>
                    
                    <div>
                      <p className="text-muted-foreground">🎯 Validation Radius</p>
                      <p className="font-semibold text-blue-600">
                        {location.radius_meters} meters
                      </p>
                    </div>
                    
                    <div>
                      <p className="text-muted-foreground">🗺️ Map View</p>
                      <a 
                        href={getMapsLink(location.latitude, location.longitude)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        View on Maps →
                      </a>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <div className="text-xs text-muted-foreground">
                      ID: {location.id} • Radius: {location.radius_meters}m
                    </div>
                    
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" disabled>
                        <Edit className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                      <Button variant="outline" size="sm" disabled>
                        <Trash2 className="h-3 w-3 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Info Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <MapPin className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="font-semibold text-blue-900 mb-2">📍 How GPS Validation Works</h4>
              <div className="text-sm text-blue-800 space-y-1">
                <p>• Teachers must be within the specified radius to clock in/out</p>
                <p>• GPS coordinates are automatically captured during attendance</p>
                <p>• Invalid locations are flagged but still recorded for review</p>
                <p>• Recommended radius: 50-200 meters depending on school size</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}