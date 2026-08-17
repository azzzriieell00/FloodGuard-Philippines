const fs = require("fs");
const path = require("path");

const sourceDirectory = path.join(
  __dirname,
  "aklan-boundary-source",
  "2023",
  "geojson",
  "municities",
  "medres"
);

const outputDirectory = path.join(
  __dirname,
  "public",
  "geojson"
);

const outputFile = path.join(
  outputDirectory,
  "aklan-municipalities.geojson"
);

const AKLAN_NAMES = new Set([
  "Altavas",
  "Balete",
  "Banga",
  "Batan",
  "Buruanga",
  "Ibajay",
  "Kalibo",
  "Lezo",
  "Libacao",
  "Madalag",
  "Makato",
  "Malay",
  "Malinao",
  "Nabas",
  "New Washington",
  "Numancia",
  "Tangalan",
]);

function normalize(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

const normalizedAklanNames = new Set(
  [...AKLAN_NAMES].map(normalize)
);

function isAklanFeature(feature) {
  if (!feature || typeof feature !== "object") {
    return false;
  }

  const properties = feature.properties || {};

  const provinceValues = [
    properties.PROVINCE,
    properties.province,
    properties.Province,
    properties.NAME_1,
    properties.NAME1,
    properties.ADM1_EN,
  ];

  const provinceMatch = provinceValues.some(
    (value) =>
      normalize(value) === "aklan"
  );

  if (provinceMatch) {
    return true;
  }

  const municipalityValues = [
    properties.NAME_2,
    properties.NAME2,
    properties.name,
    properties.NAME,
    properties.MUNICIPALITY,
    properties.municipality,
    properties.Municipality,
    properties.ADM2_EN,
  ];

  return municipalityValues.some(
    (value) =>
      normalizedAklanNames.has(
        normalize(value)
      )
  );
}

function extractFeatures(data) {
  if (!data || typeof data !== "object") {
    return [];
  }

  if (
    data.type === "FeatureCollection" &&
    Array.isArray(data.features)
  ) {
    return data.features;
  }

  if (data.type === "Feature") {
    return [data];
  }

  return [];
}

if (!fs.existsSync(sourceDirectory)) {
  console.error(
    "Source directory was not found:"
  );

  console.error(sourceDirectory);

  process.exit(1);
}

const files = fs
  .readdirSync(sourceDirectory)
  .filter((file) =>
    file.toLowerCase().endsWith(".json")
  );

console.log(
  `Scanning ${files.length} geographic files...`
);

const aklanFeatures = [];
const foundMunicipalities = new Set();

for (const file of files) {
  const fullPath = path.join(
    sourceDirectory,
    file
  );

  try {
    const raw = fs.readFileSync(
      fullPath,
      "utf8"
    );

    if (!raw.trim()) {
      continue;
    }

    const data = JSON.parse(raw);

    const features = extractFeatures(data);

    for (const feature of features) {
      if (!isAklanFeature(feature)) {
        continue;
      }

      const properties =
        feature.properties || {};

      const municipalityValues = [
        properties.NAME_2,
        properties.NAME2,
        properties.name,
        properties.NAME,
        properties.MUNICIPALITY,
        properties.municipality,
        properties.Municipality,
        properties.ADM2_EN,
      ];

      const municipality =
        municipalityValues.find(
          (value) =>
            typeof value === "string" &&
            value.trim()
        );

      if (municipality) {
        foundMunicipalities.add(
          municipality.trim()
        );
      }

      aklanFeatures.push(feature);
    }
  } catch (error) {
    console.warn(
      `Skipped ${file}: ${error.message}`
    );
  }
}

const uniqueFeatures = [];

const seen = new Set();

for (const feature of aklanFeatures) {
  const properties =
    feature.properties || {};

  const municipalityValues = [
    properties.NAME_2,
    properties.NAME2,
    properties.name,
    properties.NAME,
    properties.MUNICIPALITY,
    properties.municipality,
    properties.Municipality,
    properties.ADM2_EN,
  ];

  const municipality =
    municipalityValues.find(
      (value) =>
        typeof value === "string" &&
        value.trim()
    );

  const key = municipality
    ? normalize(municipality)
    : JSON.stringify(
        feature.geometry
      );

  if (seen.has(key)) {
    continue;
  }

  seen.add(key);
  uniqueFeatures.push(feature);
}

const result = {
  type: "FeatureCollection",
  name: "Aklan Municipalities",
  features: uniqueFeatures,
};

fs.mkdirSync(
  outputDirectory,
  { recursive: true }
);

fs.writeFileSync(
  outputFile,
  JSON.stringify(result)
);

console.log("");
console.log(
  "======================================"
);
console.log(
  "Aklan GeoJSON generation complete"
);
console.log(
  "======================================"
);

console.log(
  `Features found: ${uniqueFeatures.length}`
);

console.log(
  `Output: ${outputFile}`
);

console.log("");
console.log("Municipalities detected:");

for (const municipality of [
  ...foundMunicipalities,
].sort()) {
  console.log(`- ${municipality}`);
}

console.log("");