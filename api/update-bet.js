export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { betId, reglerad } = req.body;

  if (!betId) {
    return res.status(400).json({ error: "Missing betId" });
  }

  const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
  const BASE_ID = "appPVgKKVrm0scfIi";
  const TABLE_ID = "DIN_BET_TABELL_ID"; // 👈 ändra denna

  try {
    const url = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}/${betId}`;

    const response = await fetch(url, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${AIRTABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fields: {
          Reglerad: reglerad,
        },
      }),
    });

    const data = await response.json();

    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({
      error: "Failed to update bet",
      details: error.message,
    });
  }
}
