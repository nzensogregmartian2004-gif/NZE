import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildLegalDocuments, LEGAL_VERSION, type CompanyInfo } from "../src/modules/legal/legal.content.ts";

const societe: CompanyInfo = { name: "NZE SARL", address: "Libreville, Gabon", email: "contact@nze.example" };

describe("documents légaux (étape 17)", () => {
  const docs = buildLegalDocuments(societe);

  test("le français et l'anglais proposent les mêmes documents, dans le même ordre", () => {
    assert.deepEqual(docs.fr.map((d) => d.slug), docs.en.map((d) => d.slug));
  });

  test("chaque section contient au moins un paragraphe non vide", () => {
    for (const lang of ["fr", "en"] as const) {
      for (const doc of docs[lang]) {
        for (const section of doc.sections) {
          assert.ok(section.paragraphs.length > 0, `${lang}/${doc.slug}/${section.heading}`);
          assert.ok(section.paragraphs.every((p) => p.trim().length > 0), `${lang}/${doc.slug}/${section.heading}`);
        }
      }
    }
  });

  test("les coordonnées de la société sont injectées", () => {
    const texte = JSON.stringify(docs.fr);
    assert.ok(texte.includes(societe.email));
    assert.ok(texte.includes(societe.name));
    assert.ok(!texte.includes("${"));
  });

  test("la version suit le format majeur.mineur", () => {
    assert.match(LEGAL_VERSION, /^\d+\.\d+$/);
  });
});
