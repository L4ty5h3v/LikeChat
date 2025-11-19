// ------------------------------------------------------
// /api/verify-activity.ts — Полностью рабочая версия
// ------------------------------------------------------

import type { NextApiRequest, NextApiResponse } from "next";

import {
  getFullCastHash,
  checkUserActivityByHash,
  checkUserReactionsByCast,
} from "@/lib/neynar";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { castUrl, userFid, activityType } = req.body;

    if (!castUrl || !userFid || !activityType) {
      return res.status(400).json({
        success: false,
        completed: false,
        error: "Missing required fields",
      });
    }

    // -----------------------
    // 1. Получение universal hash
    // -----------------------
    const fullHash = await getFullCastHash(castUrl);

    if (!fullHash) {
      return res.status(200).json({
        success: false,
        completed: false,
        error: "Не удалось получить hash из ссылки.",
        neynarExplorerUrl: `https://explorer.neynar.com/search?q=${encodeURIComponent(
          castUrl
        )}`,
      });
    }

    // -----------------------
    // 2. Проверка активности (пробуем оба метода)
    // -----------------------
    // Метод 1: Стандартная проверка через cast_hash
    let completed = await checkUserActivityByHash(
      fullHash,
      Number(userFid),
      activityType
    );

    // Метод 2: Если не найдено, пробуем через user/reactions (более надежный для свежих реакций)
    if (!completed) {
      console.log("[VERIFY] Standard check failed, trying user/reactions endpoint...");
      completed = await checkUserReactionsByCast(
        fullHash,
        Number(userFid),
        activityType
      );
    }

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
