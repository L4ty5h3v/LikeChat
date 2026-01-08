import type { NextApiRequest, NextApiResponse } from 'next';
import { Redis } from '@upstash/redis';

type TestResult = {
  success: boolean;
  timestamp: string;
  env: {
    hasUrl: boolean;
    hasToken: boolean;
    urlLength: number;
    tokenLength: number;
    urlPreview: string;
    tokenPreview: string;
  };
  connection: {
    initialized: boolean;
    error?: string;
  };
  tests: {
    ping?: {
      success: boolean;
      error?: string;
      response?: any;
    };
    read?: {
      success: boolean;
      error?: string;
      command?: string;
      response?: any;
    };
    write?: {
      success: boolean;
      error?: string;
      command?: string;
      response?: any;
    };
  };
  summary: {
    allPassed: boolean;
    message: string;
  };
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TestResult>
) {
  const result: TestResult = {
    success: false,
    timestamp: new Date().toISOString(),
    env: {
      hasUrl: false,
      hasToken: false,
      urlLength: 0,
      tokenLength: 0,
      urlPreview: '',
      tokenPreview: '',
    },
    connection: {
      initialized: false,
    },
    tests: {},
    summary: {
      allPassed: false,
      message: '',
    },
  };

  try {
    // 1. Проверяем переменные окружения
    const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
    const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

    result.env.hasUrl = !!url;
    result.env.hasToken = !!token;
    result.env.urlLength = url?.length || 0;
    result.env.tokenLength = token?.length || 0;
    result.env.urlPreview = url ? `${url.substring(0, 20)}...${url.substring(url.length - 10)}` : '';
    result.env.tokenPreview = token ? `${token.substring(0, 4)}...${token.substring(token.length - 4)}` : '';

    if (!url || !token) {
      result.summary.message = '❌ Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN';
      return res.status(200).json(result);
    }

    // 2. Инициализируем Redis клиент
    let redis: Redis;
    try {
      redis = new Redis({
        url,
        token,
      });
      result.connection.initialized = true;
    } catch (error: any) {
      result.connection.error = error?.message || 'Failed to initialize Redis client';
      result.summary.message = `❌ Connection initialization failed: ${result.connection.error}`;
      return res.status(200).json(result);
    }

    // 3. Тест PING
    try {
      const pingResponse = await redis.ping();
      result.tests.ping = {
        success: true,
        response: pingResponse,
      };
    } catch (error: any) {
      result.tests.ping = {
        success: false,
        error: error?.message || 'PING failed',
        response: error?.response?.data || error?.stack,
      };
    }

    // 4. Тест READ (проверяем список links)
    try {
      const testKey = 'likechat:links';
      const readResponse = await redis.llen(testKey);
      result.tests.read = {
        success: true,
        command: `LLEN ${testKey}`,
        response: readResponse,
      };
    } catch (error: any) {
      result.tests.read = {
        success: false,
        error: error?.message || 'READ failed',
        command: 'LLEN likechat:links',
        response: error?.response?.data || error?.stack,
      };
    }

    // 5. Тест WRITE (пробуем записать тестовое значение)
    try {
      const testKey = 'likechat:test_write';
      const testValue = `test_${Date.now()}`;
      await redis.set(testKey, testValue, { ex: 10 }); // TTL 10 секунд
      const readBack = await redis.get(testKey);
      await redis.del(testKey); // Удаляем тестовый ключ
      
      result.tests.write = {
        success: readBack === testValue,
        command: `SET ${testKey} (with TTL 10s)`,
        response: readBack === testValue ? 'Write and read back successful' : `Expected "${testValue}", got "${readBack}"`,
      };
    } catch (error: any) {
      result.tests.write = {
        success: false,
        error: error?.message || 'WRITE failed',
        command: 'SET likechat:test_write',
        response: error?.response?.data || error?.stack,
      };
    }

    // 6. Формируем итоговый результат
    const allTestsPassed = 
      result.tests.ping?.success === true &&
      result.tests.read?.success === true &&
      result.tests.write?.success === true;

    result.success = allTestsPassed;
    result.summary.allPassed = allTestsPassed;

    if (allTestsPassed) {
      result.summary.message = '✅ All tests passed! Upstash connection is working correctly.';
    } else {
      const failedTests = [];
      if (result.tests.ping?.success !== true) failedTests.push('PING');
      if (result.tests.read?.success !== true) failedTests.push('READ');
      if (result.tests.write?.success !== true) failedTests.push('WRITE');
      result.summary.message = `❌ Some tests failed: ${failedTests.join(', ')}`;
    }

    return res.status(200).json(result);
  } catch (error: any) {
    result.summary.message = `❌ Unexpected error: ${error?.message || 'Unknown error'}`;
    return res.status(200).json(result);
  }
}

