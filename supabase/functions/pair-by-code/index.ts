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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all unpaired DVX defects
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

    // Fetch all QA matrix entries
    const { data: qaEntries, error: qaError } = await supabase
      .from("qa_matrix_entries")
      .select("s_no, defect_code, defect_location_code, concern");

    if (qaError) throw qaError;
    if (!qaEntries || qaEntries.length === 0) {
      return new Response(
        JSON.stringify({ paired: 0, unpaired: dvxDefects.length, message: "No QA matrix entries to match against" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build lookup map: defect_code+location_code -> qa entry
    const qaMap = new Map<string, { s_no: number; concern: string }>();
    for (const qa of qaEntries) {
      if (qa.defect_code && qa.defect_location_code) {
        const key = `${qa.defect_code.trim().toLowerCase()}||${qa.defect_location_code.trim().toLowerCase()}`;
        qaMap.set(key, { s_no: qa.s_no, concern: qa.concern });
      }
    }

    let pairedCount = 0;
    let unpairedCount = 0;
    const updates: { id: string; qa_matrix_sno: number }[] = [];

    for (const dvx of dvxDefects) {
      const key = `${(dvx.defect_code || "").trim().toLowerCase()}||${(dvx.location_code || "").trim().toLowerCase()}`;
      const match = qaMap.get(key);
      if (match) {
        updates.push({ id: dvx.id, qa_matrix_sno: match.s_no });
        pairedCount++;
      } else {
        unpairedCount++;
      }
    }

    // Batch update paired records
    const BATCH_SIZE = 100;
    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
      const batch = updates.slice(i, i + BATCH_SIZE);
      for (const u of batch) {
        await supabase
          .from("dvx_defects")
          .update({
            pairing_status: "paired",
            pairing_method: "code",
            match_score: 1.0,
            qa_matrix_sno: u.qa_matrix_sno,
          })
          .eq("id", u.id);
      }
    }

    return new Response(
      JSON.stringify({ paired: pairedCount, unpaired: unpairedCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("pair-by-code error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
