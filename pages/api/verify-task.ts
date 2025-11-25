// ------------------------------------------------------
// /api/verify-task.ts — Полностью рабочая версия
// ------------------------------------------------------

import type { NextApiRequest, NextApiResponse } from "next";

import {
  getFullCastHash,
  checkUserTaskByHash,
  checkUserReactionsByCast,
} from "@/lib/neynar";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Проверка API ключа в начале
  const neynarApiKey = process.env.NEYNAR_API_KEY;
  if (!neynarApiKey || !neynarApiKey.trim()) {
    console.error("❌ [verify-activity] NEYNAR_API_KEY not configured on server");
    return res.status(500).json({
      success: false,
      completed: false,
      error: "Server configuration error: NEYNAR_API_KEY not set. Please configure it in Vercel environment variables.",
    });
  }

  try {
    const { castUrl, userFid, taskType } = req.body;

    if (!castUrl || !userFid || !taskType) {
      return res.status(400).json({
        success: false,
        completed: false,
        error: "Missing required fields",
      });
    }

    console.log("[VERIFY] Starting verification for:", { castUrl, userFid, taskType });

    // -----------------------
    // 1. Получение universal hash
    // -----------------------
    const fullHash = await getFullCastHash(castUrl);

    if (!fullHash) {
      console.error("[VERIFY] Failed to resolve hash from URL:", castUrl);
      return res.status(200).json({
        success: false,
        completed: false,
        error: "Не удалось получить hash из ссылки. Проверьте, что ссылка корректна и каст существует в сети Farcaster.",
        neynarExplorerUrl: `https://explorer.neynar.com/search?q=${encodeURIComponent(
          castUrl
        )}`,
      });
    }

    console.log("[VERIFY] Successfully resolved hash:", fullHash);

    // -----------------------
    // 2. Проверка задачи (пробуем оба метода)
    // -----------------------
    console.log("[VERIFY] Checking task:", { fullHash, userFid: Number(userFid), taskType, hashLength: fullHash.length });
    
    // Метод 1: Стандартная проверка через cast_hash
    console.log("[VERIFY] Method 1: checkUserTaskByHash");
    let completed = await checkUserTaskByHash(
      fullHash,
      Number(userFid),
      taskType
    );
    console.log("[VERIFY] Method 1 result:", completed);

    // Метод 2: Если не найдено, пробуем через user/reactions (более надежный для свежих реакций)
    if (!completed) {
      console.log("[VERIFY] Method 1 failed, trying Method 2: checkUserReactionsByCast");
      completed = await checkUserReactionsByCast(
        fullHash,
        Number(userFid),
        taskType
      );
      console.log("[VERIFY] Method 2 result:", completed);
    }

    console.log("[VERIFY] Final result:", { completed, castHash: fullHash });

    return res.status(200).json({
      success: true,
      completed,
      castHash: fullHash,
    });

  } catch (err: any) {
    console.error("❌ [verify-activity API error]", err);

    return res.status(500).json({
      success: false,
      completed: false,
      error: "Internal server error",
      message: err?.message || "Unknown error",
    });
  }
}
