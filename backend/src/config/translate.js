/**
 * Translation API configuration.
 *
 * OpenAI-compatible API used for translating diary content and comments.
 * TRANSLATE_API_KEY is required for the feature to work; the others have defaults.
 */
export const translateConfig = {
  apiBaseUrl: process.env.TRANSLATE_API_BASE_URL || 'https://apihub.agnes-ai.com/v1',
  apiKey: process.env.TRANSLATE_API_KEY || '',
  model: process.env.TRANSLATE_MODEL || 'agnes-2.0-flash',
};
