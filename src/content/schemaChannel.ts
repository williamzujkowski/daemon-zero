/**
 * Content channels name which registry composition built a game. Production is what
 * players get; preview adds unfinished content on top of it and is never shipped.
 * Saves carry their channel so production can refuse a preview run instead of healing it.
 */
import { z } from 'zod';

export const ContentChannelSchema = z.enum(['production', 'preview']);

export type ContentChannel = z.infer<typeof ContentChannelSchema>;
