import { z } from 'zod';

export const contactDiscoverySchema = z.object({
  roles: z.array(z.string().min(1).max(100)).min(1).max(20),
  max_results: z.number().min(1).max(50).optional().default(10),
});

export const addDiscoveredContactsSchema = z.object({
  contacts: z
    .array(
      z.object({
        first_name: z.string().min(1).max(100),
        last_name: z.string().min(1).max(100),
        email: z.string().email().max(255).optional().or(z.literal('')),
        job_title: z.string().max(200).optional(),
        linkedin_url: z.string().url().max(500).optional().or(z.literal('')),
      })
    )
    .min(1),
});

export type ContactDiscoveryInput = z.infer<typeof contactDiscoverySchema>;
export type AddDiscoveredContactsInput = z.infer<typeof addDiscoveredContactsSchema>;
