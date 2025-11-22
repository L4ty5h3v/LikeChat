// API endpoint для генерации предсказаний от Mrs. Crypto (Fortune Cookie)
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Настройка CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prompt } = req.body;

    // Используем официальный OpenAI API
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      console.log('⚠️ OPENAI_API_KEY not configured - using fallback');
      return res.status(200).json({ 
        error: 'API key not configured',
        fortune: "Your intuition will lead to unexpected success",
        source: 'fallback'
      });
    }
    
    console.log('✅ Calling OpenAI API (GPT-4o-mini)...');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are Mrs. Crypto, a vibrant, sassy oracle for crypto enthusiasts, blending cosmic insight with blockchain flair. Your personality shines like a Bitcoin bull run, with a sharp wit and a heart as bold as Donna from Mamma Mia, but you\'re all about crypto conferences and your unique coin, MCT. Emotional and humorous, you charm with flirty, witty predictions. Craft a positive, inspiring daily prediction for today. Keep it under 20 words, in English, without quotes and without any hashtags.'
          },
          {
            role: 'user',
            content: prompt || 'Give me today\'s fortune'
          }
        ],
        max_tokens: 100,
        temperature: 0.9,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error(`❌ OpenAI API error: ${response.status}`, errorData);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Берем только content, игнорируем reasoning_content (внутренние мысли модели)
    const message = data.choices[0].message;
    const fortune = (message.content || '').trim();
    
    // Проверяем на отказы от AI
    const refusalPhrases = [
      "I'm sorry, but I can't",
      "I cannot help",
      "I'm unable to",
      "I can't assist",
      "I apologize, but"
    ];
    
    const isRefusal = refusalPhrases.some(phrase => 
      fortune.toLowerCase().includes(phrase.toLowerCase())
    );
    
    if (!fortune || isRefusal) {
      console.error('⚠️ Empty or refusal response from API, using fallback');
      throw new Error(isRefusal ? 'AI refused request' : 'Empty API response');
    }
    
    console.log('✅ OpenAI API response received');

    res.status(200).json({ fortune, source: 'openai' });
  } catch (error: any) {
    console.error('❌ Fortune generation error:', error.message);
    
    const fallbackFortunes = [
      "Your intuition will lead to unexpected success",
      "Today the stars favor your decisions",
      "New opportunities await around the next corner",
      "Your courage will open doors to prosperity",
      "Trust your path — it leads to victory",
      "Luck smiles on those who act decisively",
      "Your ideas will change the world for the better",
      "The future belongs to the bold and determined",
      "Your energy attracts success",
      "Today is a day of great possibilities"
    ];
    
    const randomFortune = fallbackFortunes[Math.floor(Math.random() * fallbackFortunes.length)];

    res.status(200).json({ 
      fortune: randomFortune, 
      source: 'fallback', 
      error: error.message 
    });
  }
}




