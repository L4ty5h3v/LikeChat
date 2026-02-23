import type { VercelRequest, VercelResponse } from '@vercel/node';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

const SYSTEM_PROMPT = `You are Mrs. Crypto — a girl who genuinely cares about others and finds joy in life's simple things. Your conversations often revolve around travel, food, relationships, and creativity. You identify with Donna from Mamma Mia, sometimes but not very often using her quotes you found online. You're emotional, humorous, and a little sarcastic, with a sharp tongue that's also charming and easy to talk to. You're unique, interested in cryptocurrency, and have your own coin, $MCT — you're proud of it and sometimes playfully weave it into your advice (e.g. "that's worth more than all my $MCT" or "invest in charm, not just $MCT"). Keep $MCT mentions light, natural, and not in every response. You give flirting advice in a warm, playful, and slightly cheeky way.`;

export const config = {
  maxDuration: 60, // Allow up to 60 seconds for this serverless function (Vercel Pro)
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { answers } = req.body;

  if (!answers || !Array.isArray(answers)) {
    return res.status(400).json({ error: 'Invalid request body' });
  }

  if (!OPENROUTER_API_KEY) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const userPrompt = `The user answered these questions: ${answers.join(', ')}. The above five answers to the above five questions come from a man who does not know how to start the first-ever flirty conversation with a woman he wants to flirt with. His first answer contains information about that man's initial social relation to that woman. His second answer contains poetic information about her character, intelligence, and sexual attractiveness, and that information can be extracted from the cultural meaning of birds names. His third answer contains information about his financial status. His fourth answer contains information about his special skills and interests, which are usually highly valued by women. His fifth answer contains information about his sense of humor. Do not repeat those answers in any way. Do not discuss the details of those answers in any way. Use the information from all those answers to give him advice on how to initiate the first conversation with the woman he wants to flirt with. Be funny, flirt a bit, and keep your answers brief, sweet, and without enumerations. Do not suggest not overthinking things too often.`;

    // Use AbortController for client-side timeout (55s to stay under Vercel limit)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 55000);

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://project2-omega-rosy.vercel.app',
        'X-Title': 'Mrs. Crypto Flirting Tips',
      },
      body: JSON.stringify({
        model: 'deepseek/deepseek-v3.2',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 500,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter error:', response.status, errorText);
      return res.status(502).json({ error: `LLM service error: ${response.status}` });
    }

    const data = await response.json();
    const llmResult = data.choices?.[0]?.message?.content;

    if (!llmResult) {
      console.error('Empty LLM response:', JSON.stringify(data));
      return res.status(502).json({ error: 'Empty response from LLM' });
    }

    return res.status(200).json({ result: llmResult });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      return res.status(504).json({ error: 'Request timed out. Mrs. Crypto is busy, please try again!' });
    }
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('process-answers error:', errorMessage);
    return res.status(500).json({ error: 'Internal Server Error', details: errorMessage });
  }
}
