export default async function handler(req, res) {
  const API_KEY = process.env.AIRTABLE_API_KEY;
  const BASE_ID = "appPVgKKVrm0scfIi";
  const TABLE_ID = "tblQUvfLh6unvSVWW";

  if (!API_KEY) {
    return res.status(500).json({
      error: "AIRTABLE_API_KEY saknas i Vercel Environment Variables"
    });
  }

  try {
    let allRecords = [];
    let offset = "";

    do {
      const url = new URL(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`);
      url.searchParams.set("maxRecords", "100");

      if (offset) {
        url.searchParams.set("offset", offset);
      }

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        return res.status(response.status).json({
          error: "Fel från Airtable",
          details: data
        });
      }

      allRecords = allRecords.concat(data.records || []);
      offset = data.offset || "";
    } while (offset);

    const sortedRecords = allRecords.sort((a, b) => {
      const aVal = Number(a.fields?.["Totalpoäng"] || 0);
      const bVal = Number(b.fields?.["Totalpoäng"] || 0);
      return bVal - aVal;
    });

    return res.status(200).json(sortedRecords);
  } catch (err) {
    return res.status(500).json({
      error: "Fel vid hämtning från Airtable",
      details: String(err)
    });
  }
} 
