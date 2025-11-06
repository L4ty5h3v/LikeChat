// Тестовый endpoint для проверки работы Neynar API
import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

const NEYNAR_API_KEY = process.env.NEXT_PUBLIC_NEYNAR_API_KEY || '';
const NEYNAR_BASE_URL = 'https://api.neynar.com/v2';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const castHash = req.query.hash as string || '0xf9660a16';
  const testResults: any[] = [];

  // Проверяем наличие API ключа
  if (!NEYNAR_API_KEY) {
    return res.status(200).json({
      error: 'NEXT_PUBLIC_NEYNAR_API_KEY not configured',
      apiKeyPresent: false,
      testResults: [],
    });
  }

  // Тест 1: С параметром identifier и type
  try {
    const response1 = await axios.get(`${NEYNAR_BASE_URL}/farcaster/cast`, {
      params: {
        identifier: castHash,
        type: 'hash',
      },
      headers: {
        'api_key': NEYNAR_API_KEY,
        'Content-Type': 'application/json',
      },
    });
    testResults.push({
      method: 'identifier + type',
      success: true,
      status: response1.status,
      hasData: !!response1.data,
      dataKeys: response1.data ? Object.keys(response1.data) : [],
      cast: response1.data?.result?.cast || response1.data?.cast || response1.data?.result || response1.data,
      author: response1.data?.result?.cast?.author || response1.data?.cast?.author || null,
    });
  } catch (error: any) {
    testResults.push({
      method: 'identifier + type',
      success: false,
      status: error?.response?.status,
      statusText: error?.response?.statusText,
      error: error?.response?.data || error?.message,
    });
  }

  // Тест 2: Только identifier
  try {
    const response2 = await axios.get(`${NEYNAR_BASE_URL}/farcaster/cast`, {
      params: {
        identifier: castHash,
      },
      headers: {
        'api_key': NEYNAR_API_KEY,
        'Content-Type': 'application/json',
      },
    });
    testResults.push({
      method: 'identifier only',
      success: true,
      status: response2.status,
      hasData: !!response2.data,
      dataKeys: response2.data ? Object.keys(response2.data) : [],
      cast: response2.data?.result?.cast || response2.data?.cast || response2.data?.result || response2.data,
      author: response2.data?.result?.cast?.author || response2.data?.cast?.author || null,
    });
  } catch (error: any) {
    testResults.push({
      method: 'identifier only',
      success: false,
      status: error?.response?.status,
      statusText: error?.response?.statusText,
      error: error?.response?.data || error?.message,
    });
  }

  // Тест 3: С параметром hash
  try {
    const response3 = await axios.get(`${NEYNAR_BASE_URL}/farcaster/cast`, {
      params: {
        hash: castHash,
      },
      headers: {
        'api_key': NEYNAR_API_KEY,
        'Content-Type': 'application/json',
      },
    });
    testResults.push({
      method: 'hash',
      success: true,
      status: response3.status,
      hasData: !!response3.data,
      dataKeys: response3.data ? Object.keys(response3.data) : [],
      cast: response3.data?.result?.cast || response3.data?.cast || response3.data?.result || response3.data,
      author: response3.data?.result?.cast?.author || response3.data?.cast?.author || null,
    });
  } catch (error: any) {
    testResults.push({
      method: 'hash',
      success: false,
      status: error?.response?.status,
      statusText: error?.response?.statusText,
      error: error?.response?.data || error?.message,
    });
  }

  // Тест 4: API ключ в query параметрах
  try {
    const response4 = await axios.get(`${NEYNAR_BASE_URL}/farcaster/cast`, {
      params: {
        identifier: castHash,
        type: 'hash',
        api_key: NEYNAR_API_KEY,
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });
    testResults.push({
      method: 'api_key in query',
      success: true,
      status: response4.status,
      hasData: !!response4.data,
      dataKeys: response4.data ? Object.keys(response4.data) : [],
      cast: response4.data?.result?.cast || response4.data?.cast || response4.data?.result || response4.data,
      author: response4.data?.result?.cast?.author || response4.data?.cast?.author || null,
    });
  } catch (error: any) {
    testResults.push({
      method: 'api_key in query',
      success: false,
      status: error?.response?.status,
      statusText: error?.response?.statusText,
      error: error?.response?.data || error?.message,
    });
  }

  return res.status(200).json({
    apiKeyPresent: true,
    apiKeyPreview: NEYNAR_API_KEY ? `${NEYNAR_API_KEY.substring(0, 8)}...` : 'NOT SET',
    castHash: castHash,
    testResults: testResults,
    summary: {
      total: testResults.length,
      successful: testResults.filter(r => r.success).length,
      failed: testResults.filter(r => !r.success).length,
    },
  });
}

