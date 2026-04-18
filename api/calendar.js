export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
  const BASE_ID = "appPVgKKVrm0scfIi";
  const TABLE_ID = "tbluSSafeAATcbEb8";

  if (!AIRTABLE_API_KEY) {
    return res.status(500).json({
      error: "Missing AIRTABLE_API_KEY in environment variables"
    });
  }

  try {
    const fields = [
      "Datum",
      "Bana"
    ];

    let allRecords = [];
    let offset = "";

    do {
      const url = new URL(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`);

      fields.forEach((field) => {
        url.searchParams.append("fields[]", field);
      });

      if (offset) {
        url.searchParams.set("offset", offset);
      }

      const airtableRes = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Authorization: `Bearer ${AIRTABLE_API_KEY}`,
          "Content-Type": "application/json"
        }
      });

      const rawText = await airtableRes.text();

      if (!airtableRes.ok) {
        return res.status(airtableRes.status).json({
          error: "Airtable request failed",
          status: airtableRes.status,
          details: rawText
        });
      }

      let data;
      try {
        data = JSON.parse(rawText);
      } catch (parseError) {
        return res.status(500).json({
          error: "Could not parse Airtable response as JSON",
          details: rawText
        });
      }

      allRecords = allRecords.concat(data.records || []);
      offset = data.offset || "";
    } while (offset);

    return res.status(200).json({
      records: allRecords
    });
  } catch (error) {
    return res.status(500).json({
      error: "Server error while fetching calendar",
      details: error.message
    });
  }
}
