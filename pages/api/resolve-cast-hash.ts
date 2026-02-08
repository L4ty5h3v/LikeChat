import type { NextApiRequest, NextApiResponse } from "next";

import { getFullCastHash } from "@/lib/neynar";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  // No caching — this is used for interactive link opening.
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  const neynarApiKey = process.env.NEYNAR_API_KEY;
  if (!neynarApiKey || !neynarApiKey.trim()) {
    return res.status(500).json({
      success: false,
      error: "Server configuration error: NEYNAR_API_KEY not set",
    });
  }

  try {
    const { castUrl } = req.body as { castUrl?: string };

    if (!castUrl || typeof castUrl !== "string") {
      return res.status(400).json({ success: false, error: "Missing castUrl" });
    }

    // Note: some historical data may contain "..." in URLs; we can only try to resolve as-is.
    const fullHash = await getFullCastHash(castUrl);

    if (!fullHash) {
      return res.status(200).json({
        success: false,
        error: "Failed to resolve cast hash",
      });
    }

    return res.status(200).json({ success: true, hash: fullHash });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: "Internal server error",
      message: err?.message || "Unknown error",
    });
  }
}

