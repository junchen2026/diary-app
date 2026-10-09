/**
 * Translation API configuration.
 *
 * OpenAI-compatible API used for translating diary content and comments.
 * Credentials come from environment variables — never hardcode them here.
 * (.env locally / Environment Variables on Vercel)
 */
export const translateConfig = {
  apiBaseUrl: process.env.TRANSLATE_API_BASE_URL || 'https://apihub.agnes-ai.com/v1',
  apiKey: process.env.TRANSLATE_API_KEY || '',
  model: process.env.TRANSLATE_MODEL || 'agnes-2.5-flash',
};
