const fs = require("fs");
const path = require("path");
const { dissolve } = require("@turf/dissolve");

const inputPath = path.join(
  process.cwd(),
  "public",
  "geojson",
  "aklan-barangays.geojson"
);

const outputPath = path.join(
  process.cwd(),
  "public",
  "geojson",
  "aklan-municipalities.geojson"
);

console.log("Reading:");
console.log(inputPath);

if (!fs.existsSync(inputPath)) {
  throw new Error(`Barangay GeoJSON not found: ${inputPath}`);
}

const raw = fs.readFileSync(inputPath, "utf8");

if (!raw.trim()) {
  throw new Error("Barangay GeoJSON file is empty.");
}

const barangayData = JSON.parse(raw);

if (barangayData.type !== "FeatureCollection") {
  throw new Error("Barangay GeoJSON must be a FeatureCollection.");
}

if (!Array.isArray(barangayData.features)) {
  throw new Error("Barangay GeoJSON has no features array.");
}

if (barangayData.features.length === 0) {
  throw new Error("Barangay GeoJSON contains zero features.");
}

console.log(`Barangays loaded: ${barangayData.features.length}`);

// Keep only Aklan records.
const aklanBarangays = barangayData.features.filter((feature) => {
  const properties = feature.properties || {};

  const province =
    properties.province ||
    properties.Province ||
    properties.adm1_en ||
    "";

  const adm2 = String(properties.adm2_psgc || "");

  return (
    String(province).toUpperCase() === "AKLAN" ||
    adm2 === "600400000"
  );
});

console.log(`Aklan barangays: ${aklanBarangays.length}`);

if (aklanBarangays.length === 0) {
  throw new Error("No Aklan barangays were found.");
}

// Create a clean FeatureCollection.
const aklanCollection = {
  type: "FeatureCollection",
  features: aklanBarangays,
};

// Dissolve barangays by municipality PSGC.
const municipalities = dissolve(
  aklanCollection,
  "adm3_psgc"
);

// Normalize municipality properties.
municipalities.features = municipalities.features.map((feature) => {
  const p = feature.properties || {};

  const adm3 = String(
    p.adm3_psgc ||
    p.adm3 ||
    ""
  );

  return {
    type: "Feature",
    properties: {
      adm1_psgc: 600000000,
      adm2_psgc: 600400000,
      adm3_psgc: adm3,
      province: "Aklan",
      geo_level: "Mun",
    },
    geometry: feature.geometry,
  };
});

const output = {
  type: "FeatureCollection",
  features: municipalities.features,
};

fs.writeFileSync(
  outputPath,
  JSON.stringify(output)
);

console.log("");
console.log("====================================");
console.log("Aklan Municipality GeoJSON Generated");
console.log("====================================");
console.log(`Municipalities: ${output.features.length}`);
console.log(`Output: ${outputPath}`);
console.log("====================================");