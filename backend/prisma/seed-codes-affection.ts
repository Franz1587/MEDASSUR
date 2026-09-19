// Codification des affections CNAMGS (2026-08) — transcrite depuis
// "804317157-CODIFICATION-DES-AFFECTIONS.pdf" (voir demande utilisateur :
// "implémenter dans la base de données les codes d'affection suivants").
// Seuls les codes FEUILLES (sélectionnables) sont repris ici — les
// intitulés de chapitre (ex. "A00 – A13") ne sont que des bornes de plage,
// jamais des codes utilisables tels quels. Codes/libellés reproduits tels
// quels depuis le document source (y compris ses incohérences de
// numérotation internes, ex. C07.1a/2b/3c).

export interface CodeAffectionSeed {
  code: string;
  libelle: string;
  chapitre: string;
}

export const codesAffection: CodeAffectionSeed[] = [
  // MALADIES INFECTIEUSES ET PARASITAIRES (A00–A13)
  { code: "A01", libelle: "Paludisme", chapitre: "Maladies infectieuses et parasitaires" },
  { code: "A02", libelle: "Tuberculose", chapitre: "Maladies infectieuses et parasitaires" },
  { code: "A03", libelle: "VIH-SIDA", chapitre: "Maladies infectieuses et parasitaires" },
  { code: "A04", libelle: "Grippe", chapitre: "Maladies infectieuses et parasitaires" },
  { code: "A05", libelle: "Fièvre typhoïde", chapitre: "Maladies infectieuses et parasitaires" },
  { code: "A06", libelle: "Septicémie", chapitre: "Maladies infectieuses et parasitaires" },
  { code: "A07", libelle: "Méningite", chapitre: "Maladies infectieuses et parasitaires" },
  { code: "A08", libelle: "Amibiase", chapitre: "Maladies infectieuses et parasitaires" },
  { code: "A09", libelle: "Helminthiase", chapitre: "Maladies infectieuses et parasitaires" },
  { code: "A10", libelle: "Bilharziose", chapitre: "Maladies infectieuses et parasitaires" },
  { code: "A11", libelle: "Lèpre", chapitre: "Maladies infectieuses et parasitaires" },
  { code: "A12", libelle: "Choléra", chapitre: "Maladies infectieuses et parasitaires" },
  { code: "A13", libelle: "Autres maladies infectieuses et parasitaires", chapitre: "Maladies infectieuses et parasitaires" },

  // LES TUMEURS (C00–C08)
  { code: "C01.a", libelle: "Tumeurs du cerveau — Tumeurs bénignes", chapitre: "Les tumeurs" },
  { code: "C01.b", libelle: "Tumeurs du cerveau — Tumeurs malignes", chapitre: "Les tumeurs" },
  { code: "C02.a", libelle: "Tumeurs de la sphère ORL et pulmonaire — Tumeurs bénignes", chapitre: "Les tumeurs" },
  { code: "C02.b", libelle: "Tumeurs de la sphère ORL et pulmonaire — Tumeurs malignes", chapitre: "Les tumeurs" },
  { code: "C03.1a", libelle: "Tumeurs de l'œil — Tumeurs bénignes", chapitre: "Les tumeurs" },
  { code: "C03.1b", libelle: "Tumeurs de l'œil — Tumeurs malignes", chapitre: "Les tumeurs" },
  { code: "C04.1a", libelle: "Tumeurs du système digestif — Foie — Tumeurs bénignes", chapitre: "Les tumeurs" },
  { code: "C04.1b", libelle: "Tumeurs du système digestif — Foie — Tumeurs malignes", chapitre: "Les tumeurs" },
  { code: "C04.2a", libelle: "Tumeurs du système digestif — Estomac — Tumeurs bénignes", chapitre: "Les tumeurs" },
  { code: "C04.2b", libelle: "Tumeurs du système digestif — Estomac — Tumeurs malignes", chapitre: "Les tumeurs" },
  { code: "C04.3a", libelle: "Tumeurs du système digestif — Pancréas — Tumeurs bénignes", chapitre: "Les tumeurs" },
  { code: "C04.3b", libelle: "Tumeurs du système digestif — Pancréas — Tumeurs malignes", chapitre: "Les tumeurs" },
  { code: "C04.4a", libelle: "Tumeurs du système digestif — Colon — Tumeurs bénignes", chapitre: "Les tumeurs" },
  { code: "C04.4b", libelle: "Tumeurs du système digestif — Colon — Tumeurs malignes", chapitre: "Les tumeurs" },
  { code: "C04.5a", libelle: "Autres tumeurs digestives", chapitre: "Les tumeurs" },
  { code: "C05.1a", libelle: "Tumeurs génito-urinaires — Ovaires — Tumeurs bénignes", chapitre: "Les tumeurs" },
  { code: "C05.1b", libelle: "Tumeurs génito-urinaires — Ovaires — Tumeurs malignes", chapitre: "Les tumeurs" },
  { code: "C05.2a", libelle: "Tumeurs génito-urinaires — Utérus — Tumeurs bénignes", chapitre: "Les tumeurs" },
  { code: "C05.2b", libelle: "Tumeurs génito-urinaires — Utérus — Tumeurs malignes", chapitre: "Les tumeurs" },
  { code: "C05.3a", libelle: "Tumeurs génito-urinaires — Seins — Tumeurs bénignes", chapitre: "Les tumeurs" },
  { code: "C05.3b", libelle: "Tumeurs génito-urinaires — Seins — Tumeurs malignes", chapitre: "Les tumeurs" },
  { code: "C05.4a", libelle: "Tumeurs génito-urinaires — Prostate — Tumeurs bénignes", chapitre: "Les tumeurs" },
  { code: "C05.4b", libelle: "Tumeurs génito-urinaires — Prostate — Tumeurs malignes", chapitre: "Les tumeurs" },
  { code: "C05.5a", libelle: "Tumeurs génito-urinaires — Vessie — Tumeurs bénignes", chapitre: "Les tumeurs" },
  { code: "C05.5b", libelle: "Tumeurs génito-urinaires — Vessie — Tumeurs malignes", chapitre: "Les tumeurs" },
  { code: "C05.6a", libelle: "Tumeurs génito-urinaires — Reins — Tumeurs bénignes", chapitre: "Les tumeurs" },
  { code: "C05.6b", libelle: "Tumeurs génito-urinaires — Reins — Tumeurs malignes", chapitre: "Les tumeurs" },
  { code: "C05.7a", libelle: "Autres tumeurs génito-urinaires", chapitre: "Les tumeurs" },
  { code: "C06.1a", libelle: "Tumeurs osseuses — Tumeurs bénignes", chapitre: "Les tumeurs" },
  { code: "C06.1b", libelle: "Tumeurs osseuses — Tumeurs malignes", chapitre: "Les tumeurs" },
  { code: "C07.1a", libelle: "Affections malignes du sang — Leucémie", chapitre: "Les tumeurs" },
  { code: "C07.2b", libelle: "Affections malignes du sang — Hodgking", chapitre: "Les tumeurs" },
  { code: "C07.3c", libelle: "Autres affections malignes du sang", chapitre: "Les tumeurs" },
  { code: "C08.1a", libelle: "Tumeurs endocriniennes — Tumeurs bénignes", chapitre: "Les tumeurs" },
  { code: "C08.2b", libelle: "Tumeurs endocriniennes — Tumeurs malignes", chapitre: "Les tumeurs" },
  { code: "C08.3c", libelle: "Autres tumeurs endocriniennes", chapitre: "Les tumeurs" },

  // MALADIES DU SANG ET DU SYSTEME IMMUNITAIRE (D00–D05)
  { code: "D01", libelle: "Drépanocytose", chapitre: "Maladies du sang et du système immunitaire" },
  { code: "D02", libelle: "Hémophilie", chapitre: "Maladies du sang et du système immunitaire" },
  { code: "D03", libelle: "B thalassémie", chapitre: "Maladies du sang et du système immunitaire" },
  { code: "D04", libelle: "Troubles graves de l'hémostase", chapitre: "Maladies du sang et du système immunitaire" },
  { code: "D05", libelle: "Déficit immunitaire grave et autres maladies du sang", chapitre: "Maladies du sang et du système immunitaire" },

  // MALADIES ENDOCRINIENNES ET METABOLIQUES (E00–E06)
  { code: "E01", libelle: "Diabète", chapitre: "Maladies endocriniennes et métaboliques" },
  { code: "E02", libelle: "Obésité", chapitre: "Maladies endocriniennes et métaboliques" },
  { code: "E03", libelle: "Malnutrition protéino-calorique", chapitre: "Maladies endocriniennes et métaboliques" },
  { code: "E04", libelle: "Hyperthyroïdie", chapitre: "Maladies endocriniennes et métaboliques" },
  { code: "E05", libelle: "Hypothyroïdie", chapitre: "Maladies endocriniennes et métaboliques" },
  { code: "E06", libelle: "Autres maladies endocriniennes et métaboliques", chapitre: "Maladies endocriniennes et métaboliques" },

  // TROUBLES MENTAUX ET DU COMPORTEMENT (F00–F08)
  { code: "F01", libelle: "Démence", chapitre: "Troubles mentaux et du comportement" },
  { code: "F02", libelle: "Psychose", chapitre: "Troubles mentaux et du comportement" },
  { code: "F03", libelle: "Névrose obsessionnelle", chapitre: "Troubles mentaux et du comportement" },
  { code: "F04", libelle: "Schizophrénie", chapitre: "Troubles mentaux et du comportement" },
  { code: "F05", libelle: "Anorexie mentale", chapitre: "Troubles mentaux et du comportement" },
  { code: "F06", libelle: "Arriération mentale", chapitre: "Troubles mentaux et du comportement" },
  { code: "F07", libelle: "Dépression", chapitre: "Troubles mentaux et du comportement" },
  { code: "F08", libelle: "Autres troubles mentaux et du comportement", chapitre: "Troubles mentaux et du comportement" },

  // MALADIES DU SYSTÈME NERVEUX (G00–G10)
  { code: "G01", libelle: "Épilepsie", chapitre: "Maladies du système nerveux" },
  { code: "G02", libelle: "Paraplégie", chapitre: "Maladies du système nerveux" },
  { code: "G03", libelle: "Hémiplégie", chapitre: "Maladies du système nerveux" },
  { code: "G04", libelle: "Névrite", chapitre: "Maladies du système nerveux" },
  { code: "G05", libelle: "Migraine", chapitre: "Maladies du système nerveux" },
  { code: "G06", libelle: "Sciatique", chapitre: "Maladies du système nerveux" },
  { code: "G07", libelle: "Maladie de Parkinson", chapitre: "Maladies du système nerveux" },
  { code: "G08", libelle: "Alzheimer", chapitre: "Maladies du système nerveux" },
  { code: "G09", libelle: "Sclérose en plaques", chapitre: "Maladies du système nerveux" },
  { code: "G10", libelle: "Autres maladies du système nerveux", chapitre: "Maladies du système nerveux" },

  // MALADIES DE L'ŒIL ET DE SES ANNEXES (H00–H07)
  { code: "H01", libelle: "Conjonctivite", chapitre: "Maladies de l'œil et de ses annexes" },
  { code: "H02", libelle: "Blépharite orgelet", chapitre: "Maladies de l'œil et de ses annexes" },
  { code: "H03", libelle: "Glaucome", chapitre: "Maladies de l'œil et de ses annexes" },
  { code: "H04", libelle: "Trouble d'acuité visuelle", chapitre: "Maladies de l'œil et de ses annexes" },
  { code: "H05", libelle: "Cataracte", chapitre: "Maladies de l'œil et de ses annexes" },
  { code: "H06", libelle: "Cécité", chapitre: "Maladies de l'œil et de ses annexes" },
  { code: "H07", libelle: "Autres maladies de l'œil et de ses annexes", chapitre: "Maladies de l'œil et de ses annexes" },

  // MALADIE DE L'OREILLE, DU NEZ ET DE L'APOPHYSE MASTOÏDE (H50–H56)
  { code: "H51", libelle: "Otite bouchon", chapitre: "Maladies de l'oreille, du nez et de l'apophyse mastoïde" },
  { code: "H52", libelle: "Cérumen", chapitre: "Maladies de l'oreille, du nez et de l'apophyse mastoïde" },
  { code: "H53", libelle: "Perforation du tympan", chapitre: "Maladies de l'oreille, du nez et de l'apophyse mastoïde" },
  { code: "H54", libelle: "Rhinite", chapitre: "Maladies de l'oreille, du nez et de l'apophyse mastoïde" },
  { code: "H55", libelle: "Épistaxis", chapitre: "Maladies de l'oreille, du nez et de l'apophyse mastoïde" },
  { code: "H56", libelle: "Autres maladies de l'oreille, du nez et de l'apophyse mastoïde", chapitre: "Maladies de l'oreille, du nez et de l'apophyse mastoïde" },

  // MALADIES DE L'APPAREIL CIRCULATOIRE (I00–I12)
  { code: "I01", libelle: "HTA ou maladie hypertensive", chapitre: "Maladies de l'appareil circulatoire" },
  { code: "I02", libelle: "Insuffisance cardiaque", chapitre: "Maladies de l'appareil circulatoire" },
  { code: "I03", libelle: "Accident vasculo-cérébral (AVC)", chapitre: "Maladies de l'appareil circulatoire" },
  { code: "I04", libelle: "Cardiomyopathie", chapitre: "Maladies de l'appareil circulatoire" },
  { code: "I05", libelle: "Maladie ischémique", chapitre: "Maladies de l'appareil circulatoire" },
  { code: "I06", libelle: "Cardiopathie rhumatismale", chapitre: "Maladies de l'appareil circulatoire" },
  { code: "I07", libelle: "Artériosclérose", chapitre: "Maladies de l'appareil circulatoire" },
  { code: "I08", libelle: "Affection cardiaque et valvulaire", chapitre: "Maladies de l'appareil circulatoire" },
  { code: "I09", libelle: "Infarctus", chapitre: "Maladies de l'appareil circulatoire" },
  { code: "I10", libelle: "Angine de poitrine", chapitre: "Maladies de l'appareil circulatoire" },
  { code: "I11", libelle: "Embolie pulmonaire", chapitre: "Maladies de l'appareil circulatoire" },
  { code: "I12", libelle: "Autres maladies de l'appareil circulatoire", chapitre: "Maladies de l'appareil circulatoire" },

  // MALADIES DE L'APPAREIL RESPIRATOIRE (J00–J07)
  { code: "J01", libelle: "Bronchite", chapitre: "Maladies de l'appareil respiratoire" },
  { code: "J02", libelle: "Asthme", chapitre: "Maladies de l'appareil respiratoire" },
  { code: "J03", libelle: "Pneumonie", chapitre: "Maladies de l'appareil respiratoire" },
  { code: "J04", libelle: "Œdème aigu du poumon (OAP)", chapitre: "Maladies de l'appareil respiratoire" },
  { code: "J05", libelle: "Abcès du poumon", chapitre: "Maladies de l'appareil respiratoire" },
  { code: "J06", libelle: "Mucoviscidose", chapitre: "Maladies de l'appareil respiratoire" },
  { code: "J07", libelle: "Autres maladies de l'appareil respiratoire", chapitre: "Maladies de l'appareil respiratoire" },

  // MALADIES DE L'APPAREIL DIGESTIF ET DE SES ANNEXES (K00–K14)
  { code: "K01", libelle: "Gastro-entérite", chapitre: "Maladies de l'appareil digestif et de ses annexes" },
  { code: "K02", libelle: "Hernie inguinale", chapitre: "Maladies de l'appareil digestif et de ses annexes" },
  { code: "K03", libelle: "Hernie ombilicale", chapitre: "Maladies de l'appareil digestif et de ses annexes" },
  { code: "K04", libelle: "Appendicite", chapitre: "Maladies de l'appareil digestif et de ses annexes" },
  { code: "K05", libelle: "Abcès du foie", chapitre: "Maladies de l'appareil digestif et de ses annexes" },
  { code: "K06", libelle: "Cirrhose du foie", chapitre: "Maladies de l'appareil digestif et de ses annexes" },
  { code: "K07", libelle: "Hépatites", chapitre: "Maladies de l'appareil digestif et de ses annexes" },
  { code: "K08", libelle: "Occlusion intestinale", chapitre: "Maladies de l'appareil digestif et de ses annexes" },
  { code: "K09", libelle: "Constipation", chapitre: "Maladies de l'appareil digestif et de ses annexes" },
  { code: "K10", libelle: "Œsophagite", chapitre: "Maladies de l'appareil digestif et de ses annexes" },
  { code: "K11", libelle: "Affection des voies biliaires", chapitre: "Maladies de l'appareil digestif et de ses annexes" },
  { code: "K12", libelle: "Affection du pancréas", chapitre: "Maladies de l'appareil digestif et de ses annexes" },
  { code: "K13", libelle: "Ulcère d'estomac", chapitre: "Maladies de l'appareil digestif et de ses annexes" },
  { code: "K14", libelle: "Autres maladies de l'appareil digestif et de ses annexes", chapitre: "Maladies de l'appareil digestif et de ses annexes" },

  // MALADIES DE LA PEAU ET DU TISSU CELLULAIRE SOUS-CUTANÉ (L00–L09)
  { code: "L01", libelle: "Dermatoses mycosiques", chapitre: "Maladies de la peau et du tissu cellulaire sous-cutané" },
  { code: "L02", libelle: "Brûlures", chapitre: "Maladies de la peau et du tissu cellulaire sous-cutané" },
  { code: "L03", libelle: "Dermatoses virales", chapitre: "Maladies de la peau et du tissu cellulaire sous-cutané" },
  { code: "L04", libelle: "Folliculite", chapitre: "Maladies de la peau et du tissu cellulaire sous-cutané" },
  { code: "L05", libelle: "Eczéma", chapitre: "Maladies de la peau et du tissu cellulaire sous-cutané" },
  { code: "L06", libelle: "Lichen-plan", chapitre: "Maladies de la peau et du tissu cellulaire sous-cutané" },
  { code: "L07", libelle: "Gale", chapitre: "Maladies de la peau et du tissu cellulaire sous-cutané" },
  { code: "L08", libelle: "Dermatoses allergiques", chapitre: "Maladies de la peau et du tissu cellulaire sous-cutané" },
  { code: "L09", libelle: "Autres maladies de la peau et du tissu cellulaire sous-cutané", chapitre: "Maladies de la peau et du tissu cellulaire sous-cutané" },

  // MALADIES DU SYSTÈME OSTÉO-ARTICULAIRE ET DES MUSCLES (M00–M12)
  { code: "M01", libelle: "Entorse", chapitre: "Maladies du système ostéo-articulaire et des muscles" },
  { code: "M02", libelle: "Foulure", chapitre: "Maladies du système ostéo-articulaire et des muscles" },
  { code: "M03", libelle: "Luxation", chapitre: "Maladies du système ostéo-articulaire et des muscles" },
  { code: "M04", libelle: "Fracture", chapitre: "Maladies du système ostéo-articulaire et des muscles" },
  { code: "M05", libelle: "Ostéite", chapitre: "Maladies du système ostéo-articulaire et des muscles" },
  { code: "M06", libelle: "Polyarthrite", chapitre: "Maladies du système ostéo-articulaire et des muscles" },
  { code: "M07", libelle: "Arthrose", chapitre: "Maladies du système ostéo-articulaire et des muscles" },
  { code: "M08", libelle: "Tendinite", chapitre: "Maladies du système ostéo-articulaire et des muscles" },
  { code: "M09", libelle: "Myosite", chapitre: "Maladies du système ostéo-articulaire et des muscles" },
  { code: "M10", libelle: "Hernie discale", chapitre: "Maladies du système ostéo-articulaire et des muscles" },
  { code: "M11", libelle: "Lombalgie", chapitre: "Maladies du système ostéo-articulaire et des muscles" },
  { code: "M12", libelle: "Autres maladies du système ostéo-articulaire et des muscles", chapitre: "Maladies du système ostéo-articulaire et des muscles" },

  // MALADIES DE L'APPAREIL GÉNITO-URINAIRE (N00–N18)
  { code: "N01", libelle: "Dysménorrhée", chapitre: "Maladies de l'appareil génito-urinaire" },
  { code: "N02", libelle: "Vaginite", chapitre: "Maladies de l'appareil génito-urinaire" },
  { code: "N03", libelle: "Endométrite", chapitre: "Maladies de l'appareil génito-urinaire" },
  { code: "N04", libelle: "Salpingite", chapitre: "Maladies de l'appareil génito-urinaire" },
  { code: "N05", libelle: "Aménorrhée secondaire", chapitre: "Maladies de l'appareil génito-urinaire" },
  { code: "N06", libelle: "Ménorragie", chapitre: "Maladies de l'appareil génito-urinaire" },
  { code: "N07", libelle: "Aménorrhée primaire", chapitre: "Maladies de l'appareil génito-urinaire" },
  { code: "N08", libelle: "Polype", chapitre: "Maladies de l'appareil génito-urinaire" },
  { code: "N09", libelle: "Leucorrhées", chapitre: "Maladies de l'appareil génito-urinaire" },
  { code: "N10", libelle: "Malformation génito-urinaire", chapitre: "Maladies de l'appareil génito-urinaire" },
  { code: "N11", libelle: "Pyélonéphrite", chapitre: "Maladies de l'appareil génito-urinaire" },
  { code: "N12", libelle: "Insuffisance rénale", chapitre: "Maladies de l'appareil génito-urinaire" },
  { code: "N13", libelle: "Glomérulonéphrite", chapitre: "Maladies de l'appareil génito-urinaire" },
  { code: "N14", libelle: "Infection urinaire", chapitre: "Maladies de l'appareil génito-urinaire" },
  { code: "N15", libelle: "Affection du sein (excepté affection maligne)", chapitre: "Maladies de l'appareil génito-urinaire" },
  { code: "N16", libelle: "Stérilité", chapitre: "Maladies de l'appareil génito-urinaire" },
  { code: "N17", libelle: "Impuissance sexuelle et frigidité", chapitre: "Maladies de l'appareil génito-urinaire" },
  { code: "N18", libelle: "Autres maladies du système génito-urinaire", chapitre: "Maladies de l'appareil génito-urinaire" },

  // AFFECTIONS LIÉES À LA GROSSESSE ET À L'ACCOUCHEMENT (O00–O19)
  { code: "O01", libelle: "Menace d'avortement", chapitre: "Affections liées à la grossesse et à l'accouchement" },
  { code: "O02", libelle: "Avortement", chapitre: "Affections liées à la grossesse et à l'accouchement" },
  { code: "O03", libelle: "Menace d'accouchement prématuré", chapitre: "Affections liées à la grossesse et à l'accouchement" },
  { code: "O04", libelle: "Accouchement prématuré", chapitre: "Affections liées à la grossesse et à l'accouchement" },
  { code: "O05", libelle: "Vomissement gravidique", chapitre: "Affections liées à la grossesse et à l'accouchement" },
  { code: "O06", libelle: "Diabète et grossesse", chapitre: "Affections liées à la grossesse et à l'accouchement" },
  { code: "O07", libelle: "HTA et grossesse", chapitre: "Affections liées à la grossesse et à l'accouchement" },
  { code: "O08", libelle: "Placenta praevia", chapitre: "Affections liées à la grossesse et à l'accouchement" },
  { code: "O09", libelle: "Hématome rétroplacentaire", chapitre: "Affections liées à la grossesse et à l'accouchement" },
  { code: "O10", libelle: "Grossesse multiple", chapitre: "Affections liées à la grossesse et à l'accouchement" },
  { code: "O11", libelle: "Rupture utérine", chapitre: "Affections liées à la grossesse et à l'accouchement" },
  { code: "O12", libelle: "Grossesse extra-utérine (GEU)", chapitre: "Affections liées à la grossesse et à l'accouchement" },
  { code: "O13", libelle: "Retard de croissance intra-utérin", chapitre: "Affections liées à la grossesse et à l'accouchement" },
  { code: "O14", libelle: "Accouchement normal", chapitre: "Affections liées à la grossesse et à l'accouchement" },
  { code: "O15", libelle: "Accouchement par césarienne", chapitre: "Affections liées à la grossesse et à l'accouchement" },
  { code: "O16", libelle: "Engorgement mammaire", chapitre: "Affections liées à la grossesse et à l'accouchement" },
  { code: "O17", libelle: "Psychose puerpérale", chapitre: "Affections liées à la grossesse et à l'accouchement" },
  { code: "O18", libelle: "Infection néonatale", chapitre: "Affections liées à la grossesse et à l'accouchement" },
  { code: "O19", libelle: "Autres affections liées à la grossesse et à l'accouchement", chapitre: "Affections liées à la grossesse et à l'accouchement" },

  // AFFECTIONS DE LA PÉRIODE PERINATALE (P00)
  { code: "P00", libelle: "Affections de la période périnatale", chapitre: "Affections de la période périnatale" },

  // MALFORMATIONS CONGÉNITALES ET ANOMALIES CHROMOSOMIQUES (Q00)
  { code: "Q00", libelle: "Malformations congénitales et anomalies chromosomiques", chapitre: "Malformations congénitales et anomalies chromosomiques" },

  // LÉSIONS TRAUMATIQUES (R00–R10)
  { code: "R01", libelle: "Fracture osseuse", chapitre: "Lésions traumatiques" },
  { code: "R02", libelle: "Luxation osseuse", chapitre: "Lésions traumatiques" },
  { code: "R03", libelle: "Contusion", chapitre: "Lésions traumatiques" },
  { code: "R04", libelle: "Étirement ligamentaire", chapitre: "Lésions traumatiques" },
  { code: "R05", libelle: "Plaie par arme blanche", chapitre: "Lésions traumatiques" },
  { code: "R06", libelle: "Plaie par balle (arme à feu)", chapitre: "Lésions traumatiques" },
  { code: "R07", libelle: "Agression", chapitre: "Lésions traumatiques" },
  { code: "R08", libelle: "Électrocution", chapitre: "Lésions traumatiques" },
  { code: "R09", libelle: "Accident de la voie publique (AVP)", chapitre: "Lésions traumatiques" },
  { code: "R10", libelle: "Autres lésions traumatiques", chapitre: "Lésions traumatiques" },

  // INTOXICATIONS (S00–S04)
  { code: "S01", libelle: "Empoisonnement", chapitre: "Intoxications" },
  { code: "S02", libelle: "Intoxication accidentelle", chapitre: "Intoxications" },
  { code: "S03", libelle: "Tentative de suicide", chapitre: "Intoxications" },
  { code: "S04", libelle: "Autres intoxications", chapitre: "Intoxications" },

  // MALADIES ODONTO-STOMATOLOGIQUES (T00–T11)
  { code: "T01", libelle: "Caries dentaires", chapitre: "Maladies odonto-stomatologiques" },
  { code: "T02", libelle: "Abcès dentaires", chapitre: "Maladies odonto-stomatologiques" },
  { code: "T03", libelle: "Dents incluses et enclavées", chapitre: "Maladies odonto-stomatologiques" },
  { code: "T04", libelle: "Maladies de la pulpe et des tissus périapicaux", chapitre: "Maladies odonto-stomatologiques" },
  { code: "T05", libelle: "Gengivites et maladies périodontales", chapitre: "Maladies odonto-stomatologiques" },
  { code: "T06", libelle: "Maladies de la mâchoire", chapitre: "Maladies odonto-stomatologiques" },
  { code: "T07", libelle: "Maladies de la glande salivaire", chapitre: "Maladies odonto-stomatologiques" },
  { code: "T08", libelle: "Stomatite et affections apparentées", chapitre: "Maladies odonto-stomatologiques" },
  { code: "T09", libelle: "Tumeurs bénignes", chapitre: "Maladies odonto-stomatologiques" },
  { code: "T10", libelle: "Tumeurs malignes", chapitre: "Maladies odonto-stomatologiques" },
  { code: "T11", libelle: "Autres maladies odonto-stomatologiques", chapitre: "Maladies odonto-stomatologiques" },

  // MALADIES MAXILLO-FACIALES (U00–U08)
  { code: "U01", libelle: "Cellulite ou adénite génienne", chapitre: "Maladies maxillo-faciales" },
  { code: "U02", libelle: "Paralysie faciale", chapitre: "Maladies maxillo-faciales" },
  { code: "U03", libelle: "Dépression traumatique (ou enfoncement) de la face", chapitre: "Maladies maxillo-faciales" },
  { code: "U04", libelle: "Dépression sous-cutanée oro-faciale", chapitre: "Maladies maxillo-faciales" },
  { code: "U05", libelle: "Syndrome algo-dysfonctionnel de l'articulation temporo-mandibulaire", chapitre: "Maladies maxillo-faciales" },
  { code: "U06", libelle: "Tumeurs bénignes", chapitre: "Maladies maxillo-faciales" },
  { code: "U07", libelle: "Tumeurs malignes", chapitre: "Maladies maxillo-faciales" },
  { code: "U08", libelle: "Autres maladies maxillo-faciales", chapitre: "Maladies maxillo-faciales" },
];
