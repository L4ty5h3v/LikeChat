# LikeChat

![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0%2B-3178C6?logo=typescript&logoColor=white)
![Farcaster](https://img.shields.io/badge/Farcaster-mini%20app-8A63D2?logo=farcaster&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-Upstash-DC382D?logo=redis&logoColor=white)
![Solidity](https://img.shields.io/badge/Solidity-contracts-363636?logo=solidity&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-deploy-black?logo=vercel&logoColor=white)

LikeChat is a Farcaster mini app for social engagement tasks, cast link submissions, and token-based rewards. The app combines a Next.js frontend, Farcaster wallet auth, Neynar-based verification, Redis-backed state, and Solidity/Hardhat tooling for the token-sale side of the project.

## Overview

- users connect with a Farcaster wallet
- choose a task type such as likes, recasts, or comments
- submit Farcaster cast links for others to complete
- verify activity through server-side checks and polling
- reward completed actions with MCT token flows

## Tech Stack

- Next.js 14
- React 18
- TypeScript
- Farcaster Mini App SDK
- OnchainKit
- Neynar API
- Upstash Redis
- Solidity, Hardhat, Ethers, Viem, Wagmi
- Vercel

## How It Works

1. The user authenticates with a Farcaster wallet.
2. The app loads available tasks and the user’s progress.
3. Links are submitted through the app and stored server-side.
4. Activity is verified with Neynar API calls and polling.
5. Completed items update the UI and token-related flows.

## Local Development

```bash
git clone https://github.com/N4L34/LikeChat.git
cd LikeChat
npm install
cp .env.example .env.local
npm run dev
```

The app runs at `http://localhost:3000`.

Required environment variables are documented in `.env.example`.

## Deployment

- Vercel is the primary frontend deployment target
- API keys and Redis credentials stay in environment variables
- Hardhat scripts support contract compilation, deployment, and funding flows

## Useful Scripts

- `npm run compile`
- `npm run deploy`
- `npm run fund`
- `npm run check-db`

## Repository Layout

```text
components/   UI building blocks
contexts/     Farcaster auth state
contracts/    Solidity contracts
lib/          API, Redis, and web3 helpers
pages/        Next.js routes and API endpoints
public/       static assets and Farcaster metadata
scripts/      deployment and maintenance scripts
styles/       global styling
```

## Notes

- The app is optimized for Farcaster mini app flows.
- Activity verification uses server-side logic rather than client trust.
- The repository includes both UI code and onchain support code, so it reads like a full product rather than a demo.
