const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    customer: { type: "string" },
    vehicle: { type: "string" },
    vin: { type: "string" },
    cccJobNumber: { type: "string" },
    claimNumber: { type: "string" },
    workfileId: { type: "string" },
    insuranceCompany: { type: "string" },
    estimator: { type: "string" },
    bodyLaborHours: { type: "number" },
    paintLaborHours: { type: "number" },
    frameLaborHours: { type: "number" },
    mechanicalLaborHours: { type: "number" },
    totalLaborHours: { type: "number" },
    partsTotal: { type: "number" },
    bodyLaborTotal: { type: "number" },
    paintLaborTotal: { type: "number" },
    paintMaterialsTotal: { type: "number" },
    salesTax: { type: "number" },
    totalCostOfRepairs: { type: "number" },
    deductible: { type: "number" },
    adjustments: { type: "number" },
    netCostOfRepairs: { type: "number" },
    confidenceNotes: { type: "array", items: { type: "string" } },
  },
  required: [
    "customer", "vehicle", "vin", "cccJobNumber", "claimNumber", "workfileId",
    "insuranceCompany", "estimator", "bodyLaborHours", "paintLaborHours",
    "frameLaborHours", "mechanicalLaborHours", "totalLaborHours", "partsTotal",
    "bodyLaborTotal", "paintLaborTotal", "paintMaterialsTotal", "salesTax",
    "totalCostOfRepairs", "deductible", "adjustments", "netCostOfRepairs",
    "confidenceNotes"
  ],
};

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: "Estimate scanning is not configured yet. Add OPENAI_API_KEY to the server environment." });
    return;
  }

  const documents = Array.isArray(req.body?.documents) ? req.body.documents.slice(0, 4) : [];
  if (!documents.length) {
    res.status(400).json({ error: "No estimate images were provided." });
    return;
  }

  const invalid = documents.find((doc: any) => typeof doc?.dataUrl !== "string" || !doc.dataUrl.startsWith("data:image/"));
  if (invalid) {
    res.status(400).json({ error: "This sprint currently accepts CCC estimate images (JPEG, PNG, or WebP)." });
    return;
  }

  const content: any[] = [
    {
      type: "input_text",
      text: [
        "Extract job intake data from these CCC ONE collision estimate pages.",
        "The images may include a preliminary-estimate cover page and/or Estimate Totals page.",
        "Return only values visible in the documents. Use empty strings or zero when absent.",
        "Do not confuse claim number, CCC job number, RO number, and workfile ID.",
        "For labor, capture body, paint, frame, and mechanical hours separately when shown.",
        "Set totalLaborHours to the sum of those labor-hour categories. Do not count paint supplies/material units as labor hours.",
        "For financial fields, capture Parts, Body Labor dollars, Paint Labor dollars, Paint Supplies/Materials, Sales Tax, Total Cost of Repairs, Deductible, Total Adjustments, and Net Cost of Repairs when shown.",
        "Add a short confidence note only for fields that are unreadable, ambiguous, or inferred from a subtotal rather than directly printed."
      ].join(" ")
    },
    ...documents.map((doc: any) => ({ type: "input_image", image_url: doc.dataUrl, detail: "high" })),
  ];

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_ESTIMATE_MODEL || "gpt-5",
        input: [{ role: "user", content }],
        text: {
          format: {
            type: "json_schema",
            name: "ccc_estimate_intake",
            strict: true,
            schema,
          },
        },
      }),
    });

    const payload = await response.json();
    if (!response.ok) {
      console.error("OpenAI estimate scan error", payload);
      res.status(502).json({ error: "The estimate could not be read. Try a clearer photo or try again." });
      return;
    }

    const outputText = payload.output_text || payload.output?.flatMap((item: any) => item.content || []).find((item: any) => item.type === "output_text")?.text;
    if (!outputText) {
      res.status(502).json({ error: "The estimate scan returned no structured data." });
      return;
    }

    res.status(200).json(JSON.parse(outputText));
  } catch (error) {
    console.error("Estimate intake failure", error);
    res.status(500).json({ error: "Estimate scanning failed unexpectedly." });
  }
}
