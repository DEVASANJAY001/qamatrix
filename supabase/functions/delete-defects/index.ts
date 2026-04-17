import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DELETE_PASSWORD = "DEVA2468";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { target } = await req.json();
    console.log("Delete target:", target);

    const validTargets = ["DVX", "SCA", "YARD", "ALL", "FINAL"];
    if (!target || !validTargets.includes(target)) {
      return new Response(JSON.stringify({ error: `Invalid target: ${target}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const results: string[] = [];

    if (target === "ALL") {
      // 1. defect_data
      const { error: e1 } = await supabase.from("defect_data").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (e1) results.push(`defect_data error: ${e1.message}`);
      else results.push("defect_data: all records deleted");

      // 2. final_defect
      const { error: e2 } = await supabase.from("final_defect").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (e2) results.push(`final_defect error: ${e2.message}`);
      else results.push("final_defect: all records deleted");

      // 3. dvx_defects
      const { error: e3 } = await supabase.from("dvx_defects").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (e3) results.push(`dvx_defects error: ${e3.message}`);
      else results.push("dvx_defects: all records deleted");

    } else if (target === "FINAL") {
      const { error } = await supabase.from("final_defect").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (error) results.push(`final_defect error: ${error.message}`);
      else results.push("final_defect: all records deleted");
    } else if (target === "DVX") {
      // Delete DVX source from defect_data (legacy)
      const { error: e1 } = await supabase.from("defect_data").delete().eq("source", "DVX");
      if (e1) results.push(`defect_data DVX error: ${e1.message}`);

      // Delete from dvx_defects (new)
      const { error: e2 } = await supabase.from("dvx_defects").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (e2) results.push(`dvx_defects error: ${e2.message}`);
      else results.push("DVX: all records deleted from both tables");

      // Also clean up final_defect
      await supabase.from("final_defect").delete().eq("source", "DVX");
    } else {
      // Delete specific source (SCA or YARD)
      const { error: e1 } = await supabase.from("defect_data").delete().eq("source", target);
      if (e1) results.push(`defect_data error: ${e1.message}`);
      else results.push(`defect_data ${target}: deleted`);

      const { error: e2 } = await supabase.from("final_defect").delete().eq("source", target);
      if (e2) results.push(`final_defect error: ${e2.message}`);
      else results.push(`final_defect ${target}: deleted`);
    }

    console.log("Results:", results);
    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
