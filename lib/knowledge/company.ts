// ============================================================================
// COMPANY KNOWLEDGE BASE
// ----------------------------------------------------------------------------
// What the AI should always "know" about the business: who we are, where we
// work, and the door options/materials we offer. The shop builds CUSTOM doors,
// so treat this as the menu of common options to orient around — not a hard
// limit. Sourced from elegantentrydoors.ca (+ standard industry options).
//
// 👉 This is meant to be edited freely as the catalogue changes. It's plain
//    data — change the strings/lists below and the AI picks it up everywhere.
// ============================================================================

export const COMPANY = {
  name: "Elegant Entry Doors",
  whatWeDo:
    "Custom entry & exterior door systems — manufactured, finished, and installed in-house.",
  experienceYears: 15,
  // Greater Toronto Area + Vancouver and surrounding areas.
  serviceArea: [
    "Toronto / GTA",
    "Markham",
    "Mississauga",
    "Brampton",
    "Oakville",
    "Oshawa",
    "Newmarket",
    "Vancouver & surrounding",
  ],
  manufacturing:
    "In-house CNC machinery; all painting & staining done on site; eco-friendly water-based paint (flawless semi-gloss on steel); 15+ years staining woodgrain fibreglass for natural, long-lasting shades.",
};

export const CATALOG = {
  // Primary product is the front/entry door; we also build related systems.
  doorTypes: [
    "Entry / front door (single)",
    "Double entry doors",
    "Entry with sidelights (one or two)",
    "Entry with transom (rectangular or elliptical)",
    "Patio & French doors",
    "Storm / screen doors",
  ],
  materials: [
    "Steel — 20-gauge, foam-filled insulated core, water-based semi-gloss paint",
    "Fibreglass — woodgrain, stainable to natural shades, reinforced",
  ],
  glass: [
    "Decorative / wrought-iron glass inserts",
    "Clear, frosted/obscure, and privacy glass",
    "Grilles and caming patterns",
    "Sidelight & transom glass to match",
  ],
  finishes: [
    "Painted — wide range of colours, semi-gloss (steel)",
    "Stained — natural woodgrain shades (fibreglass)",
  ],
  hardware: [
    "Handlesets and grip handles",
    "Multipoint locking systems",
    "Deadbolts and smart locks",
    "Hinges and finishes (black, satin nickel, brass, etc.)",
  ],
  services: [
    "Custom design & manufacturing",
    "Professional measuring & installation",
    "On-site finishing",
    "Warranty",
  ],
};

// A compact text block injected into the AI prompts so every extraction and
// follow-up is grounded in OUR real options and materials.
export function companyKnowledge(): string {
  return [
    `COMPANY: ${COMPANY.name} — ${COMPANY.whatWeDo}`,
    `EXPERIENCE: ${COMPANY.experienceYears}+ years. ${COMPANY.manufacturing}`,
    `SERVICE AREA: ${COMPANY.serviceArea.join(", ")}.`,
    ``,
    `WE OFFER (we build CUSTOM, so these are the common options to orient around — not limits):`,
    `- Door types: ${CATALOG.doorTypes.join("; ")}.`,
    `- Materials: ${CATALOG.materials.join("; ")}.`,
    `- Glass: ${CATALOG.glass.join("; ")}.`,
    `- Finishes: ${CATALOG.finishes.join("; ")}.`,
    `- Hardware: ${CATALOG.hardware.join("; ")}.`,
    `- Services: ${CATALOG.services.join("; ")}.`,
    ``,
    `Use this to interpret what the client wants (map their words to our materials/`,
    `options), to sound knowledgeable in follow-ups, and to flag anything we don't`,
    `typically do. Never promise a material/option not listed unless the client`,
    `explicitly requested a custom build.`,
  ].join("\n");
}
