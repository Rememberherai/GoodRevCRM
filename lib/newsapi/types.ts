import { z } from 'zod';

// NewsAPI.ai (Event Registry) response schemas

export const newsApiSourceSchema = z.object({
  uri: z.string().optional(),
  dataType: z.string().optional(),
  title: z.string().optional(),
});

export const newsApiArticleSchema = z.object({
  uri: z.string(),
  lang: z.string().optional(),
  isDuplicate: z.boolean().optional(),
  date: z.string().optional(),
  time: z.string().optional(),
  dateTime: z.string().optional(),
  dateTimePub: z.string().optional(),
  dataType: z.string().optional(),
  sim: z.number().optional(),
  url: z.string(),
  title: z.string(),
  body: z.string().optional(),
  source: newsApiSourceSchema.optional(),
  authors: z.array(z.object({
    uri: z.string().optional(),
    name: z.string().optional(),
    type: z.string().optional(),
    isAgency: z.boolean().optional(),
  })).optional(),
  image: z.string().nullable().optional(),
  eventUri: z.string().nullable().optional(),
  sentiment: z.number().nullable().optional(),
  wgt: z.number().optional(),
  relevance: z.number().optional(),
});

export const newsApiResponseSchema = z.object({
  articles: z.object({
    results: z.array(newsApiArticleSchema),
    totalResults: z.number(),
    page: z.number(),
    count: z.number(),
    pages: z.number(),
  }),
});

export type NewsApiSource = z.infer<typeof newsApiSourceSchema>;
export type NewsApiArticle = z.infer<typeof newsApiArticleSchema>;
export type NewsApiResponse = z.infer<typeof newsApiResponseSchema>;

export class NewsApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: unknown
  ) {
    super(message);
    this.name = 'NewsApiError';
  }
}
