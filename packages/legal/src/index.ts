export const SADC_LEGAL_REGISTRY = {
    ZA: {
        jurisdiction: process.env.LEGAL_JURISDICTION || "GLOBAL",
  standard: "ISO/IEC 42001 & NIST AI RMF",
        law: "Protection of Personal Information Act (POPIA)",
        automated_decision_section: "Section 71",
        rights: ["Agency", "Explanation", "Empathy", "Correction", "Truth"],
        enforcement_body: "Information Regulator",
        status: "GOLD_STANDARD"
    },
    BW: {
        country: "Botswana",
        law: "Data Protection Act 2018",
        automated_decision_section: "Section 20",
        rights: ["Right to object to automated decision-making"],
        enforcement_body: "Information Commissioner",
        status: "MAPPED"
    },
    MU: {
        country: "Mauritius",
        law: "Data Protection Act 2017",
        automated_decision_section: "Section 38",
        rights: ["Human intervention", "Right to express point of view"],
        enforcement_body: "Data Protection Commissioner",
        status: "MAPPED"
    }
};
