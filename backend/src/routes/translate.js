/**
 * Translate route — proxy to an OpenAI-compatible LLM API.
 *
 * Endpoints:
 *   POST /api/translate — body { text, direction: 'to-zh' | 'to-en' } → { translation }
 */
import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { translateConfig } from '../config/translate.js';

const router = Router();
router.use(authMiddleware);

router.post('/', async (req, res) => {
  const { text, direction } = req.body;
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'text is required' });
  }
  if (direction !== 'to-zh' && direction !== 'to-en') {
    return res.status(400).json({ error: 'direction must be "to-zh" or "to-en"' });
  }
  if (!translateConfig.apiKey) {
    return res.status(503).json({ error: 'Translation is not configured' });
  }

  const prompt = direction === 'to-zh'
    ? `translate <context> from English to 繁體中文 at expert level. <context>${text}</context>`
    : `translate <context> from 繁體中文 to English at expert level. <context>${text}</context>`;

  const llmRes = await fetch(`${translateConfig.apiBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${translateConfig.apiKey}`,
    },
    body: JSON.stringify({
      model: translateConfig.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    }),
  });

  if (!llmRes.ok) {
    console.error('[translate] LLM API error:', llmRes.status, await llmRes.text());
    return res.status(502).json({ error: `LLM API error (${llmRes.status})` });
  }

  const llmData = await llmRes.json();
  const translation = llmData.choices?.[0]?.message?.content?.trim() || '';
  res.json({ translation });
});

export default router;
