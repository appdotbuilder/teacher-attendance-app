import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Clock, MapPin, Camera, Users, Calendar, CheckCircle } from 'lucide-react';
import { trpc } from '@/utils/trpc';
import { ClockInForm } from '@/components/ClockInForm';
import { ClockOutForm } from '@/components/ClockOutForm';
import { AttendanceRecords } from '@/components/AttendanceRecords';
import { SchoolLocationManager } from '@/components/SchoolLocationManager';
import type { TeacherAttendance, SchoolLocation } from '../../server/src/schema';

function App() {
  const [attendanceRecords, setAttendanceRecords] = useState<TeacherAttendance[]>([]);
  const [schoolLocations, setSchoolLocations] = useState<SchoolLocation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('clock-in');

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [records, locations] = await Promise.all([
        trpc.getAttendanceRecords.query(),
        trpc.getSchoolLocations.query()
      ]);
      setAttendanceRecords(records);
      setSchoolLocations(locations);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleClockIn = async (newRecord: TeacherAttendance) => {
    setAttendanceRecords((prev: TeacherAttendance[]) => [newRecord, ...prev]);
    // Switch to clock-out tab after successful clock-in
    setActiveTab('clock-out');
  };

  const handleClockOut = async (updatedRecord: TeacherAttendance) => {
    setAttendanceRecords((prev: TeacherAttendance[]) => 
      prev.map((record: TeacherAttendance) => 
        record.id === updatedRecord.id ? updatedRecord : record
      )
    );
  };

  const handleNewSchoolLocation = async (newLocation: SchoolLocation) => {
    setSchoolLocations((prev: SchoolLocation[]) => [...prev, newLocation]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="bg-blue-600 p-3 rounded-full">
              <Users className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-gray-900">
              📍 Teacher Attendance System
            </h1>
          </div>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Record your daily attendance with GPS validation, photo verification, and real-time tracking. 
            Stay connected to your school location! 🏫
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-8 w-8" />
                <div>
                  <p className="text-sm opacity-90">Today's Records</p>
                  <p className="text-2xl font-bold">
                    {attendanceRecords.filter(r => 
                      new Date(r.attendance_date).toDateString() === new Date().toDateString()
                    ).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Clock className="h-8 w-8" />
                <div>
                  <p className="text-sm opacity-90">Active Sessions</p>
                  <p className="text-2xl font-bold">
                    {attendanceRecords.filter(r => r.clock_out_time === null).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <MapPin className="h-8 w-8" />
                <div>
                  <p className="text-sm opacity-90">School Locations</p>
                  <p className="text-2xl font-bold">{schoolLocations.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-orange-500 to-orange-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Calendar className="h-8 w-8" />
                <div>
                  <p className="text-sm opacity-90">This Month</p>
                  <p className="text-2xl font-bold">
                    {attendanceRecords.filter(r => {
                      const recordDate = new Date(r.attendance_date);
                      const now = new Date();
                      return recordDate.getMonth() === now.getMonth() && 
                             recordDate.getFullYear() === now.getFullYear();
                    }).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 bg-white/80 backdrop-blur-sm">
            <TabsTrigger value="clock-in" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Clock In
            </TabsTrigger>
            <TabsTrigger value="clock-out" className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Clock Out
            </TabsTrigger>
            <TabsTrigger value="records" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Records
            </TabsTrigger>
            <TabsTrigger value="locations" className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Locations
            </TabsTrigger>
          </TabsList>

          <TabsContent value="clock-in">
            <Card className="bg-white/90 backdrop-blur-sm shadow-xl">
              <CardHeader className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-t-lg">
                <CardTitle className="flex items-center gap-3">
                  <Camera className="h-6 w-6" />
                  Clock In - Start Your Day! 🌅
                </CardTitle>
                <p className="text-blue-100">
                  Take a photo and verify your location to record your arrival
                </p>
              </CardHeader>
              <CardContent className="p-6">
                <ClockInForm 
                  schoolLocations={schoolLocations}
                  onSuccess={handleClockIn}
                  isLoading={isLoading}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="clock-out">
            <Card className="bg-white/90 backdrop-blur-sm shadow-xl">
              <CardHeader className="bg-gradient-to-r from-green-500 to-green-600 text-white rounded-t-lg">
                <CardTitle className="flex items-center gap-3">
                  <CheckCircle className="h-6 w-6" />
                  Clock Out - End Your Day! 🌅
                </CardTitle>
                <p className="text-green-100">
                  Verify your location to complete your attendance record
                </p>
              </CardHeader>
              <CardContent className="p-6">
                <ClockOutForm 
                  attendanceRecords={attendanceRecords.filter(r => r.clock_out_time === null)}
                  onSuccess={handleClockOut}
                  isLoading={isLoading}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="records">
            <Card className="bg-white/90 backdrop-blur-sm shadow-xl">
              <CardHeader className="bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-t-lg">
                <CardTitle className="flex items-center gap-3">
                  <Calendar className="h-6 w-6" />
                  Attendance Records 📊
                </CardTitle>
                <p className="text-purple-100">
                  View and filter your attendance history
                </p>
              </CardHeader>
              <CardContent className="p-6">
                <AttendanceRecords 
                  records={attendanceRecords}
                  schoolLocations={schoolLocations}
                  onRefresh={loadData}
                  isLoading={isLoading}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="locations">
            <Card className="bg-white/90 backdrop-blur-sm shadow-xl">
              <CardHeader className="bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-t-lg">
                <CardTitle className="flex items-center gap-3">
                  <MapPin className="h-6 w-6" />
                  School Locations 🏫
                </CardTitle>
                <p className="text-orange-100">
                  Manage school locations and GPS validation settings
                </p>
              </CardHeader>
              <CardContent className="p-6">
                <SchoolLocationManager 
                  locations={schoolLocations}
                  onNewLocation={handleNewSchoolLocation}
                  isLoading={isLoading}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className="text-center mt-12 text-gray-600">
          <p className="flex items-center justify-center gap-2">
            Made with ❤️ for Teachers • 
            <Badge variant="outline" className="ml-2">
              GPS Enabled
            </Badge>
            <Badge variant="outline">
              Photo Verified
            </Badge>
          </p>
        </div>
      </div>
    </div>
  );
}

export default App;