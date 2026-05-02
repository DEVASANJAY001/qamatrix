import { DVXEntry } from "@/types/dvxReport";
import { QAMatrixEntry } from "@/types/qaMatrix";

interface AIMatch {
  defectIndex: number;
  matchedSNo: number | null;
  confidence: number;
  reason: string;
}

interface AIMatchResult {
  matches: AIMatch[];
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWithRetry(url: string, options: any, maxRetries = 3): Promise<any> {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      const data = await response.json();
      
      if (response.ok) return data;
      
      // If we hit a rate limit (429) or a temporary server error (500), retry
      if (response.status === 429 || response.status === 500) {
        lastError = data.error || `HTTP ${response.status}`;
        if (attempt < maxRetries) {
          const waitTime = Math.pow(2, attempt) * 3000 + Math.random() * 1000;
          console.warn(`AI Match: Attempt ${attempt + 1} failed (${lastError}). Retrying in ${Math.round(waitTime)}ms...`);
          await delay(waitTime);
          continue;
        }
      }
      return { error: data.error || `HTTP ${response.status}` };
    } catch (err: any) {
      lastError = err.message;
      if (attempt < maxRetries) {
        const waitTime = Math.pow(2, attempt) * 3000;
        await delay(waitTime);
        continue;
      }
    }
  }
  return { error: lastError };
}

/**
 * Use AI agent to semantically match DVX defects with QA matrix concerns.
 * Sends defects in batches and respects rate limits.
 */
export async function aiMatchDefects(
  dvxEntries: DVXEntry[],
  qaData: QAMatrixEntry[]
): Promise<AIMatchResult> {
  const concerns = qaData.map((q) => ({
    sNo: q.sNo,
    concern: q.concern,
    operationStation: q.operationStation,
    designation: q.designation,
  }));

  const BATCH_SIZE = 150;
  const allMatches: AIMatch[] = [];

  for (let i = 0; i < dvxEntries.length; i += BATCH_SIZE) {
    const batch = dvxEntries.slice(i, i + BATCH_SIZE);
    const batchStart = i;
    const defects = batch.map((d, idx) => ({
      index: batchStart + idx,
      locationDetails: d.locationDetails,
      defectDescription: d.defectDescription,
      defectDescriptionDetails: d.defectDescriptionDetails,
      gravity: d.gravity,
      quantity: d.quantity,
    }));

    console.log(`AI Match: Processing batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(dvxEntries.length / BATCH_SIZE)}...`);

    const data = await fetchWithRetry("/api/match-defects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ defects, concerns }),
    });

    if (data.error) {
      console.error("AI matching error for batch:", data.error);
      allMatches.push(...batch.map((_, idx) => ({
        defectIndex: batchStart + idx,
        matchedSNo: null,
        confidence: 0,
        reason: data.error,
      })));
    } else if (data?.matches) {
      allMatches.push(...(data.matches as AIMatch[]));
    }

    // Delay to respect 5 RPM limit (12s per request)
    if (i + BATCH_SIZE < dvxEntries.length) {
      console.log(`AI Match: Waiting 12 seconds before next batch to respect rate limits...`);
      await delay(12000);
    }
  }

  return { matches: allMatches };
}
