import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch unpaired DVX defects
    const { data: dvxDefects, error: dvxError } = await supabase
      .from("dvx_defects")
      .select("*")
      .eq("pairing_status", "not_paired");

    if (dvxError) throw dvxError;
    if (!dvxDefects || dvxDefects.length === 0) {
      return new Response(
        JSON.stringify({ paired: 0, unpaired: 0, message: "No unpaired defects found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch QA matrix
    const { data: qaEntries, error: qaError } = await supabase
      .from("qa_matrix_entries")
      .select("s_no, concern, operation_station, designation, defect_code, defect_location_code");

    if (qaError) throw qaError;
    if (!qaEntries || qaEntries.length === 0) {
      return new Response(
        JSON.stringify({ paired: 0, unpaired: dvxDefects.length, message: "No QA matrix entries" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const concernsList = qaEntries
      .map(c => `[${c.s_no}] "${c.concern}" (station: ${c.operation_station}, area: ${c.designation})`)
      .join("\n");

    // Process in batches of 100
    const BATCH_SIZE = 100;
    let totalPaired = 0;
    let totalUnpaired = 0;

    for (let i = 0; i < dvxDefects.length; i += BATCH_SIZE) {
      const batch = dvxDefects.slice(i, i + BATCH_SIZE);
      const defectsList = batch
        .map((d, idx) => `[${idx}] Defect: "${d.defect_description}" | Details: "${d.defect_description_details}" | Location: "${d.location_details}" | Gravity: ${d.gravity}`)
        .join("\n");

      const systemPrompt = `You are an automotive quality assurance expert. Match defect reports to QA concerns semantically.
Consider: the actual problem described, location/area, component type, manufacturing context.
If confidence < 0.5, return null. Better unmatched than incorrectly paired.`;

      const userPrompt = `QA Matrix concerns:\n${concernsList}\n\nDefects to match:\n${defectsList}\n\nMatch each defect to the best QA concern using semantic understanding.`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          tools: [{
            type: "function",
            function: {
              name: "submit_matches",
              description: "Submit matching results",
              parameters: {
                type: "object",
                properties: {
                  matches: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        defectIndex: { type: "number" },
                        matchedSNo: { type: ["number", "null"] },
                        confidence: { type: "number" },
                        reason: { type: "string" },
                      },
                      required: ["defectIndex", "matchedSNo", "confidence", "reason"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["matches"],
                additionalProperties: false,
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "submit_matches" } },
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again shortly." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: "AI credits depleted." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const errorText = await response.text();
        console.error("AI error:", response.status, errorText);
        // Mark batch as unmatched and continue
        totalUnpaired += batch.length;
        continue;
      }

      const aiResult = await response.json();
      const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall?.function?.arguments) {
        totalUnpaired += batch.length;
        continue;
      }

      const parsed = JSON.parse(toolCall.function.arguments);
      const matches = parsed.matches || [];

      for (const m of matches) {
        const dvx = batch[m.defectIndex];
        if (!dvx) continue;

        if (m.matchedSNo !== null && m.confidence >= 0.5) {
          await supabase.from("dvx_defects").update({
            pairing_status: "paired",
            pairing_method: "semantic",
            match_score: m.confidence,
            qa_matrix_sno: m.matchedSNo,
          }).eq("id", dvx.id);
          totalPaired++;
        } else {
          totalUnpaired++;
        }
      }

      // Handle any defects not in AI response
      const respondedIndices = new Set(matches.map((m: any) => m.defectIndex));
      for (let j = 0; j < batch.length; j++) {
        if (!respondedIndices.has(j)) totalUnpaired++;
      }
    }

    return new Response(
      JSON.stringify({ paired: totalPaired, unpaired: totalUnpaired }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("pair-by-semantic error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
