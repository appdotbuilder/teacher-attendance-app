import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { z } from 'zod';

// Import schemas
import { 
  clockInInputSchema, 
  clockOutInputSchema, 
  createSchoolLocationInputSchema,
  getAttendanceQuerySchema,
  locationSchema
} from './schema';

// Import handlers
import { clockIn } from './handlers/clock_in';
import { clockOut } from './handlers/clock_out';
import { getAttendanceRecords } from './handlers/get_attendance_records';
import { getAttendanceById } from './handlers/get_attendance_by_id';
import { createSchoolLocation } from './handlers/create_school_location';
import { getSchoolLocations } from './handlers/get_school_locations';
import { validateLocation } from './handlers/validate_location';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  // Health check endpoint
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // Teacher attendance procedures
  clockIn: publicProcedure
    .input(clockInInputSchema)
    .mutation(({ input }) => clockIn(input)),

  clockOut: publicProcedure
    .input(clockOutInputSchema)
    .mutation(({ input }) => clockOut(input)),

  getAttendanceRecords: publicProcedure
    .input(getAttendanceQuerySchema)
    .query(({ input }) => getAttendanceRecords(input)),

  getAttendanceById: publicProcedure
    .input(z.number().int().positive())
    .query(({ input }) => getAttendanceById(input)),

  // School location management procedures
  createSchoolLocation: publicProcedure
    .input(createSchoolLocationInputSchema)
    .mutation(({ input }) => createSchoolLocation(input)),

  getSchoolLocations: publicProcedure
    .query(() => getSchoolLocations()),

  // Location validation procedure
  validateLocation: publicProcedure
    .input(z.object({
      location: locationSchema,
      schoolLocationId: z.number().int().positive()
    }))
    .query(({ input }) => validateLocation(input.location, input.schoolLocationId)),
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`🚀 Teacher Attendance TRPC server listening at port: ${port}`);
  console.log(`📍 Available endpoints:`);
  console.log(`   - POST /clockIn - Record teacher clock-in with photo and location`);
  console.log(`   - POST /clockOut - Record teacher clock-out with location`);
  console.log(`   - GET /getAttendanceRecords - View attendance history with filters`);
  console.log(`   - GET /getAttendanceById - Get specific attendance record`);
  console.log(`   - POST /createSchoolLocation - Create new school location`);
  console.log(`   - GET /getSchoolLocations - Get all school locations`);
  console.log(`   - GET /validateLocation - Validate GPS location against school`);
}

start();