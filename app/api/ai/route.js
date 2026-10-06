// ═══════════════════════════════════════════════════════════════
// API Route: /api/ai — Gemini LLM integration proxy
// ═══════════════════════════════════════════════════════════════
// Handles two actions: 'parse' and 'decompose'
// Requires GEMINI_API_KEY in .env.local

import { NextResponse } from 'next/server';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent';

async function callGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    console.error('[Gemini] No API key found in environment variables');
    return { error: 'NO_API_KEY', message: 'GEMINI_API_KEY not configured in .env.local' };
  }

  console.log('[Gemini] Calling API with key ending in:', apiKey.slice(-6));

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 8192,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[Gemini API Error]', response.status, errText);

      // Parse the error body for a more specific message
      let detail = `Gemini API returned ${response.status}`;
      try {
        const errJson = JSON.parse(errText);
        detail = errJson?.error?.message || detail;
      } catch (_) { /* use default detail */ }

      // Classify the error specifically
      if (response.status === 429) {
        return {
          error: 'QUOTA_EXCEEDED',
          message: 'Gemini API quota exceeded. Your API key has hit its rate limit. Please check your billing/plan at https://aistudio.google.com or wait for the quota to reset.',
          detail,
          status: 429,
        };
      }

      if (response.status === 400) {
        return {
          error: 'BAD_REQUEST',
          message: 'Gemini rejected the request — the prompt may be malformed.',
          detail,
          status: 400,
        };
      }

      if (response.status === 403) {
        return {
          error: 'INVALID_API_KEY',
          message: 'Gemini API key is invalid or does not have permission. Generate a new key at https://aistudio.google.com/app/apikey',
          detail,
          status: 403,
        };
      }

      return {
        error: 'API_ERROR',
        message: detail,
        status: response.status,
      };
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      // Check if the response was blocked by safety filters
      const blockReason = data?.candidates?.[0]?.finishReason;
      if (blockReason === 'SAFETY') {
        return { error: 'SAFETY_BLOCK', message: 'Gemini blocked the response due to safety filters' };
      }
      console.error('[Gemini] Empty response body:', JSON.stringify(data).substring(0, 500));
      return { error: 'EMPTY_RESPONSE', message: 'Gemini returned no content' };
    }

    // Parse the JSON from Gemini's response
    try {
      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned);
      console.log('[Gemini] Successfully parsed LLM response');
      return { success: true, data: parsed };
    } catch (parseErr) {
      console.error('[JSON Parse Error]', parseErr.message, 'Raw:', text.substring(0, 300));
      return { error: 'PARSE_ERROR', message: 'Failed to parse LLM response as JSON', raw: text };
    }
  } catch (fetchErr) {
    console.error('[Fetch Error]', fetchErr.message);
    return { error: 'NETWORK_ERROR', message: `Network error calling Gemini: ${fetchErr.message}` };
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { action, prompt } = body;

    if (!action || !prompt) {
      return NextResponse.json({ error: 'Missing action or prompt' }, { status: 400 });
    }

    console.log(`[API /api/ai] action="${action}", prompt length=${prompt.length}`);

    const result = await callGemini(prompt);

    if (result.error === 'NO_API_KEY') {
      return NextResponse.json(
        { fallback: true, error: result.error, message: result.message },
        { status: 200 }
      );
    }

    if (result.error === 'QUOTA_EXCEEDED') {
      // Return a non-200 status so the client knows this is a real error,
      // not just a gentle fallback suggestion
      console.error('[API] Quota exceeded — client will see the error');
      return NextResponse.json(
        { fallback: true, error: result.error, message: result.message, detail: result.detail },
        { status: 429 }
      );
    }

    if (result.error === 'INVALID_API_KEY') {
      return NextResponse.json(
        { fallback: true, error: result.error, message: result.message },
        { status: 403 }
      );
    }

    if (result.error) {
      console.error(`[API] LLM call failed: ${result.error} — ${result.message}`);
      return NextResponse.json(
        { fallback: true, error: result.error, message: result.message },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (err) {
    console.error('[API Route Error]', err);
    return NextResponse.json(
      { fallback: true, error: 'SERVER_ERROR', message: err.message },
      { status: 500 }
    );
  }
}
