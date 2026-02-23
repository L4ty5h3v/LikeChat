# Mrs. Crypto's Flirting Tips 💕

A Farcaster Mini App that gives personalized flirting tips from a digital character, Mrs. Crypto.

## How it works

1. User answers 5 fun questions about their crush and situation
2. Mrs. Crypto (powered by DeepSeek via OpenRouter) generates a personalized flirting tip
3. User can **read** or **hear** the tip (text-to-speech with device voice)
4. User can tip back by buying $MCT token via Farcaster wallet

## Tech stack

- **Next.js** — app framework (deployed on Vercel)
- **Farcaster Mini App SDK** — runs inside Farcaster client
- **OpenRouter API** — LLM for generating tips (DeepSeek v3.2)
- **Web Speech API** — text-to-speech on supported devices
- **Tailwind CSS** — styling

## Environment variables

```
OPENROUTER_API_KEY=your_key_here
```

## Development

```bash
npm install
npm run dev
```

## Deployment

Deploy to Vercel. The `/.well-known/farcaster.json` manifest is served from `public/`.
