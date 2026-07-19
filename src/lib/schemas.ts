import { z } from "zod";

export const JobReplySchema = z.object({
  company: z.string(),
  role: z.string().nullable(),
  stage: z.enum(["applied", "interview", "assessment", "offer", "rejected", "update"]),
  summary: z.string(),
});

export type JobReply = z.infer<typeof JobReplySchema>;
