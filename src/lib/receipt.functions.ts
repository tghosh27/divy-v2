import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText, Output, NoObjectGeneratedError } from "ai";
import { z } from "zod";

export type ScannedItem = { name: string; amount: number };
export type ScannedReceipt = {
  items: ScannedItem[];
  tax: number;
  tip: number;
  total: number;
};

const schema = z.object({
  items: z.array(z.object({ name: z.string(), amount: z.number() })),
  tax: z.number(),
  tip: z.number(),
  total: z.number(),
});

/** Read a receipt photo and return its line items, tax, tip and total. */
export const scanReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { image: string }) => data)
  .handler(async ({ data }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) return { ok: false as const, error: "AI is not configured yet" };
    if (!data.image?.startsWith("data:image/")) {
      return { ok: false as const, error: "That doesn't look like a photo" };
    }

    const { createLovableAiGatewayProvider } = await import("@/lib/ai-gateway.server");
    const gateway = createLovableAiGatewayProvider(key, { structuredOutputs: true });

    try {
      const { output } = await generateText({
        model: gateway("google/gemini-3.8-flash"),
        output: Output.object({ schema }),
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: [
                  "Read this receipt and list every ordered line item with its price in dollars.",
                  "Combine multiples into one line and keep the printed quantity in the name (e.g. '2 pitchers').",
                  "Do not include tax, tip, gratuity, service charge, subtotal or total in items.",
                  "Report tax as the tax amount, tip as the tip/gratuity/service charge amount (0 when absent),",
                  "and total as the final amount charged. Keep item names under 40 characters.",
                  "If a value is unreadable, use 0.",
                ].join(" "),
              },
              {
                type: "file",
                data: data.image,
                mediaType: data.image.slice(5, data.image.indexOf(";")) || "image/jpeg",
              },
            ],
          },
        ],
      });

      const items = output.items
        .map((i) => ({ name: String(i.name).slice(0, 60), amount: Math.max(0, Number(i.amount) || 0) }))
        .filter((i) => i.amount > 0);
      const tax = Math.max(0, Number(output.tax) || 0);
      const tip = Math.max(0, Number(output.tip) || 0);
      const sum = items.reduce((a, i) => a + i.amount, 0) + tax + tip;
      const total = Math.max(0, Number(output.total) || 0) || sum;

      if (!items.length) {
        return { ok: false as const, error: "Couldn't read any items off that photo" };
      }
      return { ok: true as const, receipt: { items, tax, tip, total } satisfies ScannedReceipt };
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error)) {
        return { ok: false as const, error: "Couldn't read that receipt — try a clearer photo" };
      }
      const message = error instanceof Error ? error.message : "Receipt scan failed";
      const status = (error as { statusCode?: number } | null)?.statusCode;
      if (status === 402) return { ok: false as const, error: "AI credits ran out — add credits to keep scanning" };
      if (status === 429) return { ok: false as const, error: "Too many scans right now — try again in a moment" };
      return { ok: false as const, error: message };
    }
  });
