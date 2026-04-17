import { supabase } from "@/integrations/supabase/client";
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

/**
 * Use AI agent to semantically match DVX defects with QA matrix concerns.
 * Sends defects in batches to avoid token limits.
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

  const BATCH_SIZE = 200;

  // Build all batch requests
  const batchPromises: Promise<AIMatch[]>[] = [];

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

    // Fire all batches in parallel
    batchPromises.push(
      fetch("/api/match-defects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defects, concerns }),
      }).then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          console.error("AI matching error for batch:", data.error);
          return batch.map((_, idx) => ({
            defectIndex: batchStart + idx,
            matchedSNo: null,
            confidence: 0,
            reason: data.error || "AI matching failed",
          }));
        }
        if (data?.matches) return data.matches as AIMatch[];
        return [] as AIMatch[];
      })
    );
  }

  const batchResults = await Promise.all(batchPromises);
  const allMatches = batchResults.flat();

  return { matches: allMatches };
}
