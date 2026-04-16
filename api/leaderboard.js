export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // 🔥 CACHE (NY)
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");

  // Hantera preflight
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Tillåt bara GET
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
  const BASE_ID = "appPVgKKVrm0scfIi";
  const TABLE_ID = "tblQUvfLh6unvSVWW";

  if (!AIRTABLE_API_KEY) {
    return res.status(500).json({ error: "Missing AIRTABLE_API_KEY in environment variables" });
  }

  try {
    // 🔥 BEGRÄNSA FÄLT (NY)
    const fields = [
      "Spelare",
      "Totalpoäng",
      "Poäng Sammandrag",
      "Bonuspoäng"
      "Profilbild"
    ];

    const params = new URLSearchParams();
    fields.forEach(f => params.append("fields[]", f));

    const airtableUrl = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}?${params}`;

    const airtableRes = await fetch(airtableUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${AIRTABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
    });

    const rawText = await airtableRes.text();

    if (!airtableRes.ok) {
      return res.status(airtableRes.status).json({
        error: "Airtable request failed",
        status: airtableRes.status,
        details: rawText,
      });
    }

    let data;
    try {
      data = JSON.parse(rawText);
    } catch (parseError) {
      return res.status(500).json({
        error: "Could not parse Airtable response as JSON",
        details: rawText,
      });
    }

    return res.status(200).json({
      records: data.records || [],
    });

  } catch (error) {
    return res.status(500).json({
      error: "Server error while fetching leaderboard",
      details: error.message,
    });
  }
}
