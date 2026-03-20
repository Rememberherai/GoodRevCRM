import { z } from 'zod';
import {
  dateSchema,
  jsonObjectSchema,
  nullableString,
  numericCoordinateSchema,
  optionalUuidSchema,
  uuidSchema,
} from './shared';

export const programStatusSchema = z.enum(['planning', 'active', 'completed', 'suspended']);
export const programEnrollmentStatusSchema = z.enum(['active', 'completed', 'withdrawn', 'waitlisted']);
export const waiverStatusSchema = z.enum(['not_required', 'pending', 'signed']);
export const attendanceStatusSchema = z.enum(['present', 'absent', 'excused']);

export const programScheduleSchema = jsonObjectSchema;

export const programSchema = z.object({
  project_id: optionalUuidSchema,
  name: z.string().min(1, 'Program name is required').max(200, 'Program name must be 200 characters or less'),
  description: nullableString(5000, 'Description must be 5000 characters or less'),
  target_dimensions: z.array(uuidSchema).max(25, 'Programs cannot target more than 25 dimensions').default([]),
  status: programStatusSchema.default('planning'),
  capacity: z.number().int().min(0).max(100000).nullable().optional(),
  schedule: programScheduleSchema.nullable().optional(),
  location_name: nullableString(200, 'Location must be 200 characters or less'),
  location_latitude: numericCoordinateSchema.nullable().optional(),
  location_longitude: numericCoordinateSchema.nullable().optional(),
  start_date: z.string().nullable().optional(),
  end_date: z.string().nullable().optional(),
  requires_waiver: z.boolean().default(false),
});

export const createProgramSchema = programSchema;
export const updateProgramSchema = programSchema.partial();

export const programEnrollmentSchema = z.object({
  program_id: optionalUuidSchema,
  person_id: optionalUuidSchema,
  household_id: optionalUuidSchema,
  status: programEnrollmentStatusSchema.default('active'),
  waiver_status: waiverStatusSchema.default('not_required'),
  enrolled_at: z.string().optional(),
  completed_at: z.string().nullable().optional(),
  notes: nullableString(2000, 'Notes must be 2000 characters or less'),
}).superRefine((value, ctx) => {
  if (!value.person_id && !value.household_id) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Either person_id or household_id is required',
      path: ['person_id'],
    });
  }
});

export const attendanceRecordSchema = z.object({
  person_id: uuidSchema,
  date: dateSchema,
  status: attendanceStatusSchema,
  hours: z.number().min(0).max(24).default(0),
});

export const batchAttendanceSchema = z.object({
  date: dateSchema,
  entries: z.array(attendanceRecordSchema).min(1, 'At least one attendance entry is required'),
});

export type CreateProgramInput = z.infer<typeof createProgramSchema>;
export type UpdateProgramInput = z.infer<typeof updateProgramSchema>;
export type ProgramEnrollmentInput = z.infer<typeof programEnrollmentSchema>;
export type AttendanceRecordInput = z.infer<typeof attendanceRecordSchema>;
