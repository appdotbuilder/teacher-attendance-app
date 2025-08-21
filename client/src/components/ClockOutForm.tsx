import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Clock, AlertTriangle, CheckCircle, Loader2, LogOut } from 'lucide-react';
import { trpc } from '@/utils/trpc';
import type { TeacherAttendance, ClockOutInput } from '../../../server/src/schema';

interface ClockOutFormProps {
  attendanceRecords: TeacherAttendance[];
  onSuccess: (record: TeacherAttendance) => void;
  isLoading: boolean;
}

export function ClockOutForm({ attendanceRecords, onSuccess, isLoading }: ClockOutFormProps) {
  const [selectedRecordId, setSelectedRecordId] = useState('');
  const [clockOutTime, setClockOutTime] = useState(new Date().toTimeString().split(' ')[0]);
  const [location, setLocation] = useState<{latitude: number; longitude: number} | null>(null);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [locationValidation, setLocationValidation] = useState<{is_valid: boolean; distance_meters: number} | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedRecord = attendanceRecords.find(r => r.id.toString() === selectedRecordId);

  // Get current location
  const getCurrentLocation = useCallback(async () => {
    setLocationStatus('loading');
    setLocationValidation(null);
    
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser.');
      setLocationStatus('error');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const coords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        };
        setLocation(coords);
        setLocationStatus('success');

        // Validate location if record is selected
        if (selectedRecord) {
          try {
            const validation = await trpc.validateLocation.query({
              location: coords,
              schoolLocationId: selectedRecord.school_location_id
            });
            setLocationValidation(validation);
          } catch (error) {
            console.error('Location validation failed:', error);
          }
        }
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
  }, [selectedRecord]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!selectedRecordId) {
      setError('Please select an attendance record to clock out');
      return;
    }

    if (!location) {
      setError('Please get your current location');
      return;
    }

    setIsSubmitting(true);
    
    try {
      const clockOutData: ClockOutInput = {
        attendance_id: parseInt(selectedRecordId),
        clock_out_time: clockOutTime,
        location: location
      };

      const result = await trpc.clockOut.mutate(clockOutData);
      onSuccess(result);

      // Reset form
      setSelectedRecordId('');
      setClockOutTime(new Date().toTimeString().split(' ')[0]);
      setLocation(null);
      setLocationStatus('idle');
      setLocationValidation(null);

    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to record clock out');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Calculate work duration
  const calculateDuration = (clockInTime: string, clockOutTime: string) => {
    const [inHour, inMin, inSec] = clockInTime.split(':').map(Number);
    const [outHour, outMin, outSec] = clockOutTime.split(':').map(Number);
    
    const inTotalMin = inHour * 60 + inMin + inSec / 60;
    const outTotalMin = outHour * 60 + outMin + outSec / 60;
    
    const durationMin = outTotalMin - inTotalMin;
    const hours = Math.floor(durationMin / 60);
    const minutes = Math.round(durationMin % 60);
    
    return `${hours}h ${minutes}m`;
  };

  if (attendanceRecords.length === 0) {
    return (
      <div className="text-center py-12">
        <Clock className="h-16 w-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-600 mb-2">No Active Sessions</h3>
        <p className="text-gray-500 mb-6">
          You need to clock in first before you can clock out. 
          Switch to the Clock In tab to start your day! 🌅
        </p>
        <div className="text-4xl">😴</div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Active Sessions */}
      <div className="space-y-4">
        <Label>📋 Select Active Session to Clock Out</Label>
        
        {/* Show active records as cards */}
        <div className="grid gap-4">
          {attendanceRecords.map((record: TeacherAttendance) => (
            <Card 
              key={record.id} 
              className={`cursor-pointer transition-all ${
                selectedRecordId === record.id.toString() 
                  ? 'ring-2 ring-blue-500 bg-blue-50' 
                  : 'hover:shadow-md'
              }`}
              onClick={() => setSelectedRecordId(record.id.toString())}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">👨‍🏫 {record.teacher_name}</CardTitle>
                  <Badge variant="secondary" className="bg-green-100 text-green-700">
                    🟢 Active Session
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">📅 Date</p>
                    <p className="font-medium">{new Date(record.attendance_date).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">⏰ Clock In Time</p>
                    <p className="font-medium">{record.clock_in_time}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">📍 Location Valid</p>
                    <div className="flex items-center gap-1">
                      {record.is_location_valid ? (
                        <>
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <span className="text-green-600">✅ Valid</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="h-4 w-4 text-red-600" />
                          <span className="text-red-600">⚠️ Invalid</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-muted-foreground">⏱️ Duration</p>
                    <p className="font-medium">{calculateDuration(record.clock_in_time, clockOutTime)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Clock Out Time */}
      <div className="space-y-2">
        <Label htmlFor="clock_out_time">🕐 Clock Out Time</Label>
        <Input
          id="clock_out_time"
          type="time"
          step="1"
          value={clockOutTime}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setClockOutTime(e.target.value)}
          required
        />
      </div>

      {/* Location */}
      <Card className="border-2 border-dashed border-gray-300">
        <CardContent className="p-6">
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center gap-2">
              <MapPin className="h-5 w-5" />
              <Label>🗺️ Verify GPS Location</Label>
            </div>
            
            <Button 
              type="button" 
              variant="outline" 
              onClick={getCurrentLocation}
              disabled={locationStatus === 'loading'}
              className="w-full"
            >
              {locationStatus === 'loading' && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <MapPin className="h-4 w-4 mr-2" />
              {locationStatus === 'loading' ? 'Getting Location...' : 'Get Current Location'}
            </Button>

            {location && (
              <div className="text-sm space-y-2">
                <div className="flex items-center justify-center gap-2 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  Location obtained successfully
                </div>
                <p className="text-muted-foreground">
                  📍 {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                </p>

                {locationValidation && (
                  <div className={`flex items-center justify-center gap-2 ${
                    locationValidation.is_valid ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {locationValidation.is_valid ? (
                      <>
                        <CheckCircle className="h-4 w-4" />
                        ✅ Location valid ({locationValidation.distance_meters.toFixed(0)}m from school)
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="h-4 w-4" />
                        ⚠️ Too far from school ({locationValidation.distance_meters.toFixed(0)}m away)
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Duration Preview */}
      {selectedRecord && (
        <Card className="bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
          <CardContent className="p-4">
            <div className="text-center">
              <h4 className="font-semibold text-gray-800 mb-2">⏱️ Work Session Summary</h4>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Clock In</p>
                  <p className="font-bold text-blue-600">{selectedRecord.clock_in_time}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Clock Out</p>
                  <p className="font-bold text-green-600">{clockOutTime}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total Duration</p>
                  <p className="font-bold text-purple-600">
                    {calculateDuration(selectedRecord.clock_in_time, clockOutTime)}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Submit Button */}
      <Button 
        type="submit" 
        disabled={isSubmitting || isLoading || !selectedRecordId || !location}
        className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-lg py-3"
      >
        {isSubmitting && <Loader2 className="h-5 w-5 mr-2 animate-spin" />}
        <LogOut className="h-5 w-5 mr-2" />
        {isSubmitting ? 'Recording Clock Out...' : '🏁 Clock Out Now!'}
      </Button>
    </form>
  );
}