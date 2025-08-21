import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { Camera, MapPin, Clock, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import { trpc } from '@/utils/trpc';
import type { SchoolLocation, TeacherAttendance, ClockInInput } from '../../../server/src/schema';

interface ClockInFormProps {
  schoolLocations: SchoolLocation[];
  onSuccess: (record: TeacherAttendance) => void;
  isLoading: boolean;
}

export function ClockInForm({ schoolLocations, onSuccess, isLoading }: ClockInFormProps) {
  const [formData, setFormData] = useState({
    teacher_name: '',
    attendance_date: new Date().toISOString().split('T')[0], // Today's date
    clock_in_time: new Date().toTimeString().split(' ')[0], // Current time
    school_location_id: '',
  });

  const [photo, setPhoto] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [location, setLocation] = useState<{latitude: number; longitude: number} | null>(null);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [locationValidation, setLocationValidation] = useState<{is_valid: boolean; distance_meters: number} | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user' } // Front camera for selfie
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraActive(true);
      }
    } catch (error) {
      setError('Unable to access camera. Please check permissions.');
      console.error('Camera error:', error);
    }
  }, []);

  // Take photo
  const takePhoto = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0);
        
        canvas.toBlob((blob) => {
          if (blob) {
            const photoUrl = URL.createObjectURL(blob);
            setPhoto(photoUrl);
            setPhotoFile(new File([blob], `attendance-${Date.now()}.jpg`, { type: 'image/jpeg' }));
            
            // Stop camera
            const stream = video.srcObject as MediaStream;
            if (stream) {
              stream.getTracks().forEach(track => track.stop());
            }
            setIsCameraActive(false);
          }
        }, 'image/jpeg', 0.8);
      }
    }
  }, []);

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

        // Validate location if school is selected
        if (formData.school_location_id) {
          try {
            const validation = await trpc.validateLocation.query({
              location: coords,
              schoolLocationId: parseInt(formData.school_location_id)
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
  }, [formData.school_location_id]);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!formData.teacher_name.trim()) {
      setError('Please enter your name');
      return;
    }

    if (!formData.school_location_id) {
      setError('Please select a school location');
      return;
    }

    if (!photo || !photoFile) {
      setError('Please take a photo');
      return;
    }

    if (!location) {
      setError('Please get your current location');
      return;
    }

    setIsSubmitting(true);
    
    try {
      // In a real implementation, you would upload the photo to a storage service
      // For now, we'll use a placeholder URL
      const photoUrl = `/photos/attendance-${Date.now()}.jpg`;

      const clockInData: ClockInInput = {
        teacher_name: formData.teacher_name.trim(),
        attendance_date: formData.attendance_date,
        clock_in_time: formData.clock_in_time,
        photo_url: photoUrl,
        location: location,
        school_location_id: parseInt(formData.school_location_id)
      };

      const result = await trpc.clockIn.mutate(clockInData);
      onSuccess(result);

      // Reset form
      setFormData({
        teacher_name: '',
        attendance_date: new Date().toISOString().split('T')[0],
        clock_in_time: new Date().toTimeString().split(' ')[0],
        school_location_id: '',
      });
      setPhoto(null);
      setPhotoFile(null);
      setLocation(null);
      setLocationStatus('idle');
      setLocationValidation(null);

    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to record attendance');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Teacher Information */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="teacher_name">👨‍🏫 Teacher Name</Label>
          <Input
            id="teacher_name"
            value={formData.teacher_name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setFormData((prev) => ({ ...prev, teacher_name: e.target.value }))
            }
            placeholder="Enter your full name"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="attendance_date">📅 Date</Label>
          <Input
            id="attendance_date"
            type="date"
            value={formData.attendance_date}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setFormData((prev) => ({ ...prev, attendance_date: e.target.value }))
            }
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="clock_in_time">⏰ Clock In Time</Label>
          <Input
            id="clock_in_time"
            type="time"
            step="1"
            value={formData.clock_in_time}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setFormData((prev) => ({ ...prev, clock_in_time: e.target.value }))
            }
            required
          />
        </div>
      </div>

      {/* School Location */}
      <div className="space-y-2">
        <Label htmlFor="school_location">🏫 School Location</Label>
        <Select 
          value={formData.school_location_id} 
          onValueChange={(value) => setFormData((prev) => ({ ...prev, school_location_id: value }))}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select your school location" />
          </SelectTrigger>
          <SelectContent>
            {schoolLocations.map((location: SchoolLocation) => (
              <SelectItem key={location.id} value={location.id.toString()}>
                {location.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {schoolLocations.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No school locations available. Please add one in the Locations tab.
          </p>
        )}
      </div>

      {/* Photo Capture */}
      <Card className="border-2 border-dashed border-gray-300">
        <CardContent className="p-6">
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center gap-2">
              <Camera className="h-5 w-5" />
              <Label>📸 Take Photo</Label>
            </div>
            
            {!isCameraActive && !photo && (
              <Button 
                type="button" 
                variant="outline" 
                onClick={startCamera}
                className="w-full"
              >
                <Camera className="h-4 w-4 mr-2" />
                Start Camera
              </Button>
            )}

            {isCameraActive && (
              <div className="space-y-4">
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  className="w-full max-w-sm mx-auto rounded-lg"
                />
                <Button 
                  type="button" 
                  onClick={takePhoto}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  📸 Take Photo
                </Button>
              </div>
            )}

            {photo && (
              <div className="space-y-4">
                <img src={photo} alt="Attendance Photo" className="w-full max-w-sm mx-auto rounded-lg" />
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setPhoto(null);
                    setPhotoFile(null);
                  }}
                  className="w-full"
                >
                  Retake Photo
                </Button>
              </div>
            )}

            <canvas ref={canvasRef} style={{ display: 'none' }} />
          </div>
        </CardContent>
      </Card>

      {/* Location */}
      <Card className="border-2 border-dashed border-gray-300">
        <CardContent className="p-6">
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center gap-2">
              <MapPin className="h-5 w-5" />
              <Label>🗺️ GPS Location</Label>
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

      {/* Submit Button */}
      <Button 
        type="submit" 
        disabled={isSubmitting || isLoading || !photo || !location}
        className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-lg py-3"
      >
        {isSubmitting && <Loader2 className="h-5 w-5 mr-2 animate-spin" />}
        <Clock className="h-5 w-5 mr-2" />
        {isSubmitting ? 'Recording Attendance...' : '🎯 Clock In Now!'}
      </Button>
    </form>
  );
}