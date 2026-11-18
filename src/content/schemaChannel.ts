/**
 * The content channel a save records. Every shipped build is production. `preview` names the local
 * and CI-only builds that carried Earned Access before its release (#204, #233); the marker stays so
 * production keeps refusing such a save atomically instead of healing it (nexus votes
 * gamestate-channel-marker and keep-refusing-preview-saves).
 */
import { z } from 'zod';

export const ContentChannelSchema = z.enum(['production', 'preview']);

export type ContentChannel = z.infer<typeof ContentChannelSchema>;
