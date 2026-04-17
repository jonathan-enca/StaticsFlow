import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Sample 100 records
const sample = await prisma.template.findMany({
  select: { id: true, type: true, layout: true, analysisJson: true },
  take: 100,
  orderBy: { uploadedAt: "desc" },
});

let withBackgroundType = 0;
let withProductPlacement = 0;
let analyzed = 0;

for (const t of sample) {
  const aj = t.analysisJson;
  if (aj && typeof aj === "object" && Object.keys(aj).length > 0) {
    analyzed++;
    if ("backgroundType" in aj) withBackgroundType++;
    if ("productPlacement" in aj) withProductPlacement++;
  }
}

console.log(`Sample size: ${sample.length}`);
console.log(`With non-empty analysisJson: ${analyzed}`);
console.log(`With backgroundType: ${withBackgroundType}`);
console.log(`With productPlacement: ${withProductPlacement}`);

// Show example of a record with analysisJson
const withAj = sample.find(t => t.analysisJson && typeof t.analysisJson === "object" && Object.keys(t.analysisJson).length > 0);
if (withAj) {
  console.log("\nExample analysisJson keys:", Object.keys(withAj.analysisJson));
  console.log("Example analysisJson:", JSON.stringify(withAj.analysisJson, null, 2));
}

// Type × layout distribution
const dist = await prisma.$queryRaw`
  SELECT type, layout, COUNT(*)::int as count
  FROM "Template"
  GROUP BY type, layout
  ORDER BY count DESC
`;
console.log("\nType × Layout Distribution:");
console.log(JSON.stringify(dist, null, 2));

await prisma.$disconnect();
