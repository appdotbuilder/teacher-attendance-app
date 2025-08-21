import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Clock, 
  Calendar, 
  MapPin, 
  Camera, 
  RefreshCw, 
  Search, 
  Filter,
  CheckCircle,
  AlertTriangle,
  Eye
} from 'lucide-react';
import { trpc } from '@/utils/trpc';
import type { TeacherAttendance, SchoolLocation, GetAttendanceQuery } from '../../../server/src/schema';

interface AttendanceRecordsProps {
  records: TeacherAttendance[];
  schoolLocations: SchoolLocation[];
  onRefresh: () => void;
  isLoading: boolean;
}

export function AttendanceRecords({ records, schoolLocations, onRefresh, isLoading }: AttendanceRecordsProps) {
  const [filters, setFilters] = useState({
    teacher_name: '',
    date_from: '',
    date_to: '',
    school_location_id: '',
    status: 'all' // all, active, completed
  });

  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [selectedRecord, setSelectedRecord] = useState<TeacherAttendance | null>(null);

  // Apply filters to records
  const filteredRecords = records.filter((record: TeacherAttendance) => {
    const matchesName = !filters.teacher_name || 
      record.teacher_name.toLowerCase().includes(filters.teacher_name.toLowerCase());
    
    const matchesDateFrom = !filters.date_from || 
      new Date(record.attendance_date) >= new Date(filters.date_from);
    
    const matchesDateTo = !filters.date_to || 
      new Date(record.attendance_date) <= new Date(filters.date_to);
    
    const matchesLocation = !filters.school_location_id || 
      record.school_location_id.toString() === filters.school_location_id;

    const matchesStatus = filters.status === 'all' ||
      (filters.status === 'active' && record.clock_out_time === null) ||
      (filters.status === 'completed' && record.clock_out_time !== null);

    return matchesName && matchesDateFrom && matchesDateTo && matchesLocation && matchesStatus;
  });

  // Calculate work duration
  const calculateDuration = (clockInTime: string, clockOutTime: string | null) => {
    if (!clockOutTime) return 'In Progress...';
    
    const [inHour, inMin, inSec] = clockInTime.split(':').map(Number);
    const [outHour, outMin, outSec] = clockOutTime.split(':').map(Number);
    
    const inTotalMin = inHour * 60 + inMin + inSec / 60;
    const outTotalMin = outHour * 60 + outMin + outSec / 60;
    
    const durationMin = outTotalMin - inTotalMin;
    const hours = Math.floor(durationMin / 60);
    const minutes = Math.round(durationMin % 60);
    
    return `${hours}h ${minutes}m`;
  };

  // Get school location name
  const getSchoolName = (schoolId: number) => {
    const school = schoolLocations.find(s => s.id === schoolId);
    return school?.name || `School ${schoolId}`;
  };

  // Handle search/filter
  const handleSearch = useCallback(async () => {
    try {
      const query: GetAttendanceQuery = {
        teacher_name: filters.teacher_name || undefined,
        date_from: filters.date_from || undefined,
        date_to: filters.date_to || undefined,
        school_location_id: filters.school_location_id ? parseInt(filters.school_location_id) : undefined,
      };
      
      // This would typically fetch filtered results from the server
      // For now, we're filtering on the client side
      onRefresh();
    } catch (error) {
      console.error('Search failed:', error);
    }
  }, [filters, onRefresh]);

  const clearFilters = () => {
    setFilters({
      teacher_name: '',
      date_from: '',
      date_to: '',
      school_location_id: '',
      status: 'all'
    });
  };

  // Statistics
  const stats = {
    total: filteredRecords.length,
    active: filteredRecords.filter(r => r.clock_out_time === null).length,
    completed: filteredRecords.filter(r => r.clock_out_time !== null).length,
    validLocation: filteredRecords.filter(r => r.is_location_valid).length,
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            🔍 Search & Filter Records
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="teacher_search">👨‍🏫 Teacher Name</Label>
              <Input
                id="teacher_search"
                placeholder="Search by teacher name..."
                value={filters.teacher_name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFilters(prev => ({ ...prev, teacher_name: e.target.value }))
                }
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="date_from">📅 From Date</Label>
              <Input
                id="date_from"
                type="date"
                value={filters.date_from}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFilters(prev => ({ ...prev, date_from: e.target.value }))
                }
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="date_to">📅 To Date</Label>
              <Input
                id="date_to"
                type="date"
                value={filters.date_to}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFilters(prev => ({ ...prev, date_to: e.target.value }))
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="school_filter">🏫 School Location</Label>
              <Select 
                value={filters.school_location_id} 
                onValueChange={(value) => setFilters(prev => ({ ...prev, school_location_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All locations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Locations</SelectItem>
                  {schoolLocations.map((location: SchoolLocation) => (
                    <SelectItem key={location.id} value={location.id.toString()}>
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status_filter">📊 Status</Label>
              <Select 
                value={filters.status} 
                onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Records</SelectItem>
                  <SelectItem value="active">🟢 Active Sessions</SelectItem>
                  <SelectItem value="completed">✅ Completed Sessions</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSearch} disabled={isLoading} className="flex-1">
              <Search className="h-4 w-4 mr-2" />
              Search Records
            </Button>
            <Button variant="outline" onClick={clearFilters}>
              Clear Filters
            </Button>
            <Button variant="outline" onClick={onRefresh} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-sm opacity-90">📊 Total Records</p>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{stats.active}</p>
            <p className="text-sm opacity-90">🟢 Active Now</p>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{stats.completed}</p>
            <p className="text-sm opacity-90">✅ Completed</p>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-r from-orange-500 to-orange-600 text-white">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{stats.validLocation}</p>
            <p className="text-sm opacity-90">📍 Valid Location</p>
          </CardContent>
        </Card>
      </div>

      {/* View Mode Toggle */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">
          📋 Records ({filteredRecords.length})
        </h3>
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'cards' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('cards')}
          >
            Cards
          </Button>
          <Button
            variant={viewMode === 'table' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('table')}
          >
            Table
          </Button>
        </div>
      </div>

      {/* Records Display */}
      {filteredRecords.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="text-center py-12">
            <Calendar className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-600 mb-2">No Records Found</h3>
            <p className="text-gray-500">
              {records.length === 0 
                ? "No attendance records yet. Start by clocking in! 📝"
                : "Try adjusting your search filters to find records. 🔍"
              }
            </p>
          </CardContent>
        </Card>
      ) : viewMode === 'cards' ? (
        <div className="grid gap-4">
          {filteredRecords.map((record: TeacherAttendance) => (
            <Card key={record.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={record.photo_url} alt={record.teacher_name} />
                      <AvatarFallback>
                        {record.teacher_name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h4 className="font-semibold text-lg">👨‍🏫 {record.teacher_name}</h4>
                      <p className="text-muted-foreground">
                        🏫 {getSchoolName(record.school_location_id)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Badge variant={record.clock_out_time ? 'secondary' : 'default'}>
                      {record.clock_out_time ? '✅ Completed' : '🟢 Active'}
                    </Badge>
                    <Badge variant={record.is_location_valid ? 'secondary' : 'destructive'}>
                      {record.is_location_valid ? '📍 Valid' : '⚠️ Invalid'}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Date
                    </p>
                    <p className="font-medium">{new Date(record.attendance_date).toLocaleDateString()}</p>
                  </div>
                  
                  <div>
                    <p className="text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Clock In
                    </p>
                    <p className="font-medium text-blue-600">{record.clock_in_time}</p>
                  </div>
                  
                  <div>
                    <p className="text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Clock Out
                    </p>
                    <p className="font-medium text-green-600">
                      {record.clock_out_time || 'In Progress...'}
                    </p>
                  </div>
                  
                  <div>
                    <p className="text-muted-foreground">⏱️ Duration</p>
                    <p className="font-medium text-purple-600">
                      {calculateDuration(record.clock_in_time, record.clock_out_time)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    {record.location_latitude.toFixed(4)}, {record.location_longitude.toFixed(4)}
                  </div>
                  
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setSelectedRecord(record)}
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    Details
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Teacher</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Clock In</TableHead>
                  <TableHead>Clock Out</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.map((record: TeacherAttendance) => (
                  <TableRow key={record.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={record.photo_url} alt={record.teacher_name} />
                          <AvatarFallback className="text-xs">
                            {record.teacher_name.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{record.teacher_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {getSchoolName(record.school_location_id)}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{new Date(record.attendance_date).toLocaleDateString()}</TableCell>
                    <TableCell className="text-blue-600 font-mono">{record.clock_in_time}</TableCell>
                    <TableCell className="text-green-600 font-mono">
                      {record.clock_out_time || 'In Progress...'}
                    </TableCell>
                    <TableCell className="text-purple-600 font-medium">
                      {calculateDuration(record.clock_in_time, record.clock_out_time)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {record.is_location_valid ? (
                          <>
                            <CheckCircle className="h-3 w-3 text-green-600" />
                            <span className="text-green-600 text-xs">Valid</span>
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="h-3 w-3 text-red-600" />
                            <span className="text-red-600 text-xs">Invalid</span>
                          </>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={record.clock_out_time ? 'secondary' : 'default'} className="text-xs">
                        {record.clock_out_time ? 'Completed' : 'Active'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}