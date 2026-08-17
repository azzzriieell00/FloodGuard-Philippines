const fs = require("fs");
const path = require("path");

const sourceDir = path.join(
  __dirname,
  "aklan-boundary-source",
  "2023",
  "geojson",
  "municities",
  "medres"
);

const outputDir = path.join(
  __dirname,
  "public",
  "geojson"
);

const outputFile = path.join(
  outputDir,
  "aklan-municipalities.geojson"
);

// Official Aklan municipality PSGC codes.
const aklanCodes = [
  "0600401000", // Altavas
  "0600402000", // Balete
  "0600403000", // Banga
  "0600404000", // Batan
  "0600405000", // Buruanga
  "0600406000", // Ibajay
  "0600407000", // Kalibo
  "0600408000", // Lezo
  "0600409000", // Libacao
  "0600410000", // Madalag
  "0600411000", // Makato
  "0600412000", // Malay
  "0600413000", // Malinao
  "0600414000", // Nabas
  "0600415000", // New Washington
  "0600416000", // Numancia
  "0600417000"  // Tangalan
];

const municipalityNames = {
  "0600401000": "Altavas",
  "0600402000": "Balete",
  "0600403000": "Banga",
  "0600404000": "Batan",
  "0600405000": "Buruanga",
  "0600406000": "Ibajay",
  "0600407000": "Kalibo",
  "0600408000": "Lezo",
  "0600409000": "Libacao",
  "0600410000": "Madalag",
  "0600411000": "Makato",
  "0600412000": "Malay",
  "0600413000": "Malinao",
  "0600414000": "Nabas",
  "0600415000": "New Washington",
  "0600416000": "Numancia",
  "0600417000": "Tangalan"
};

if (!fs.existsSync(sourceDir)) {
  console.error("ERROR: Source directory does not exist:");
  console.error(sourceDir);
  process.exit(1);
}

fs.mkdirSync(outputDir, {
  recursive: true
});

const features = [];

for (const code of aklanCodes) {
  const possibleFiles = [
    `bgysubmuns-municity-${code}.0.01.json`,
    `municity-${code}.0.01.json`,
    `${code}.json`
  ];

  let foundFile = null;

  for (const filename of possibleFiles) {
    const fullPath = path.join(
      sourceDir,
      filename
    );

    if (fs.existsSync(fullPath)) {
      foundFile = fullPath;
      break;
    }
  }

  if (!foundFile) {
    console.log(
      `MISSING: ${code} - ${municipalityNames[code]}`
    );
    continue;
  }

  try {
    const raw = fs.readFileSync(
      foundFile,
      "utf8"
    );

    const data = JSON.parse(raw);

    if (data.type === "FeatureCollection") {
      for (const feature of data.features || []) {
        features.push(feature);
      }
    } else if (data.type === "Feature") {
      features.push(data);
    } else {
      console.log(
        `INVALID GEOJSON: ${code}`
      );
    }

    console.log(
      `FOUND: ${municipalityNames[code]}`
    );
  } catch (error) {
    console.log(
      `ERROR reading ${code}: ${error.message}`
    );
  }
}

const geojson = {
  type: "FeatureCollection",
  name: "Aklan Municipalities",
  features
};

fs.writeFileSync(
  outputFile,
  JSON.stringify(geojson)
);

console.log("");
console.log("==============================");
console.log("AKLAN GEOJSON GENERATION");
console.log("==============================");
console.log(
  `Municipalities requested: ${aklanCodes.length}`
);
console.log(
  `Features generated: ${features.length}`
);
console.log(
  `Output: ${outputFile}`
);
console.log("==============================");