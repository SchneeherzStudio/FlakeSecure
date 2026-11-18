/**
 * ============================================================================
 * FlakeSecure Mobile App - IBAN Validation, BIC & Bank Detection Utility v2.1
 * ============================================================================
 * Provides:
 * - ISO 13616 / ISO 7064 Mod 97-10 IBAN validation & formatting
 * - Instant offline Bank Name & BIC detection from IBAN (DACH & EU focus)
 * - Optional non-blocking online fallback for regional BLZ/BIC resolution
 */

export default {};

// ISO 13616 IBAN lengths per country code
const IBAN_COUNTRY_LENGTHS = {
  DE: 22,
  AT: 20,
  CH: 21,
  LI: 21,
  FR: 27,
  ES: 24,
  NL: 18,
  BE: 16,
  LU: 20,
  IT: 27,
  GB: 22,
  IE: 22,
  PT: 25,
  PL: 28,
  DK: 18,
  SE: 24,
  NO: 15,
  FI: 18,
  CZ: 24,
  SK: 24,
  HU: 28,
  GR: 27,
  RO: 24,
  BG: 22,
  HR: 21,
  SI: 19,
  EE: 20,
  LV: 21,
  LT: 20,
  CY: 28,
  MT: 31,
};

// German 8-digit BLZ -> { bankName, bic }
const DE_BLZ_DIRECTORY = {
  // Direct & Neobanks
  '12030000': { bankName: 'Deutsche Kreditbank (DKB)', bic: 'BYLADEM1001' },
  '50010517': { bankName: 'ING-DiBa', bic: 'INGDDEFFXXX' },
  '10011001': { bankName: 'N26 Bank', bic: 'NTSBDEB1XXX' },
  '50024024': { bankName: 'C24 Bank', bic: 'CHDBDEFFXXX' },
  '20041111': { bankName: 'comdirect', bic: 'COBADEHDXXX' },
  '20041133': { bankName: 'comdirect', bic: 'COBADEHD001' },
  '20041144': { bankName: 'comdirect', bic: 'COBADEHD044' },
  '20041155': { bankName: 'comdirect', bic: 'COBADEHD055' },
  '20041166': { bankName: 'comdirect', bic: 'COBADEHD066' },
  '20041177': { bankName: 'comdirect', bic: 'COBADEHD077' },
  '76030080': { bankName: 'Consorsbank', bic: 'CSDBDE71XXX' },
  '30020900': { bankName: 'TARGOBANK', bic: 'CMCIDEDDXXX' },
  '31010833': { bankName: 'Santander Consumer Bank', bic: 'SCFBDE33XXX' },
  '50033300': { bankName: 'Santander Bank', bic: 'SCFBDE33XXX' },
  '11010100': { bankName: 'Solaris SE', bic: 'SOBKDEBBXXX' },
  '11010101': { bankName: 'Solaris SE', bic: 'SOBKDEB2XXX' },
  '70033100': { bankName: 'Baader Bank (Scalable)', bic: 'BDWBDEMMXXX' },
  '50210900': { bankName: 'Citibank / Trade Republic', bic: 'CITIDEFFXXX' },
  '10012345': { bankName: 'Trade Republic Bank', bic: 'TRBKDEBBXXX' },
  '10010178': { bankName: 'Revolut Bank', bic: 'REVOLT21XXX' },
  '37019000': { bankName: 'bunq', bic: 'BUNQDE82XXX' },
  '50321200': { bankName: 'Openbank', bic: 'OPENDEFFXXX' },
  '10010300': { bankName: 'Klarna Bank', bic: 'KLRNDEB1XXX' },
  '50031000': { bankName: 'Triodos Bank', bic: 'TRIODEFFXXX' },
  '43060967': { bankName: 'GLS Gemeinschaftsbank', bic: 'GENODEM1GLS' },
  '83094495': { bankName: 'EthikBank', bic: 'GENODEF1ETK' },
  '30060601': { bankName: 'Deutsche Apotheker- und Ärztebank', bic: 'DAAEDEDDXXX' },
  '50010700': { bankName: ' Degussa Bank / Oldenburgische Landesbank', bic: 'DEGUDEFFXXX' },
  '28020050': { bankName: 'Oldenburgische Landesbank (OLB)', bic: 'OLBOde22XXX' },
  '70022200': { bankName: 'Fidor / Smartbroker', bic: 'FDDODEMMXXX' },
  '51230800': { bankName: 'quirion / Quirin Privatbank', bic: 'QUIRDEBBXXX' },
  '10020500': { bankName: 'SozialBank', bic: 'BFSWDE33BER' },
  '37020500': { bankName: 'Bank für Sozialwirtschaft', bic: 'BFSWDE33XXX' },

  // Commerzbank
  '10040000': { bankName: 'Commerzbank', bic: 'COBADEFFXXX' },
  '20040000': { bankName: 'Commerzbank', bic: 'COBADEFFXXX' },
  '25040066': { bankName: 'Commerzbank', bic: 'COBADEFFXXX' },
  '30040000': { bankName: 'Commerzbank', bic: 'COBADEFFXXX' },
  '37040044': { bankName: 'Commerzbank', bic: 'COBADEFFXXX' },
  '40040028': { bankName: 'Commerzbank', bic: 'COBADEFFXXX' },
  '44040037': { bankName: 'Commerzbank', bic: 'COBADEFFXXX' },
  '50040000': { bankName: 'Commerzbank', bic: 'COBADEFFXXX' },
  '50080000': { bankName: 'Commerzbank', bic: 'DRESDEFFXXX' },
  '60040071': { bankName: 'Commerzbank', bic: 'COBADEFFXXX' },
  '70040041': { bankName: 'Commerzbank', bic: 'COBADEFFXXX' },
  '76040061': { bankName: 'Commerzbank', bic: 'COBADEFFXXX' },
  '85040000': { bankName: 'Commerzbank', bic: 'COBADEFFXXX' },
  '86040000': { bankName: 'Commerzbank', bic: 'COBADEFFXXX' },

  // Deutsche Bank
  '10070000': { bankName: 'Deutsche Bank', bic: 'DEUTDEBBXXX' },
  '10070024': { bankName: 'Deutsche Bank', bic: 'DEUTDEDBBER' },
  '10070100': { bankName: 'Deutsche Bank', bic: 'DEUTDEBB101' },
  '20070000': { bankName: 'Deutsche Bank', bic: 'DEUTDEHHXXX' },
  '20070024': { bankName: 'Deutsche Bank', bic: 'DEUTDEDBHAM' },
  '25070024': { bankName: 'Deutsche Bank', bic: 'DEUTDEDBHAN' },
  '30070010': { bankName: 'Deutsche Bank', bic: 'DEUTDEDDXXX' },
  '30070024': { bankName: 'Deutsche Bank', bic: 'DEUTDEDBDUE' },
  '37070024': { bankName: 'Deutsche Bank', bic: 'DEUTDEDBKOE' },
  '37070060': { bankName: 'Deutsche Bank', bic: 'DEUTDEDKXXX' },
  '44070024': { bankName: 'Deutsche Bank', bic: 'DEUTDEDBDOR' },
  '50070010': { bankName: 'Deutsche Bank', bic: 'DEUTDEFFXXX' },
  '50070024': { bankName: 'Deutsche Bank', bic: 'DEUTDEDBFRA' },
  '60070024': { bankName: 'Deutsche Bank', bic: 'DEUTDEDBSTG' },
  '60070070': { bankName: 'Deutsche Bank', bic: 'DEUTDESSXXX' },
  '70070010': { bankName: 'Deutsche Bank', bic: 'DEUTDEMMXXX' },
  '70070024': { bankName: 'Deutsche Bank', bic: 'DEUTDEDBMUC' },
  '76070024': { bankName: 'Deutsche Bank', bic: 'DEUTDEDBNBG' },
  '86070024': { bankName: 'Deutsche Bank', bic: 'DEUTDEDBLEG' },

  // Postbank
  '10010010': { bankName: 'Postbank', bic: 'PBNKDEFFXXX' },
  '20010020': { bankName: 'Postbank', bic: 'PBNKDEFFXXX' },
  '25010030': { bankName: 'Postbank', bic: 'PBNKDEFFXXX' },
  '36010043': { bankName: 'Postbank', bic: 'PBNKDEFFXXX' },
  '37010050': { bankName: 'Postbank', bic: 'PBNKDEFFXXX' },
  '44010046': { bankName: 'Postbank', bic: 'PBNKDEFFXXX' },
  '50010060': { bankName: 'Postbank', bic: 'PBNKDEFFXXX' },
  '54510067': { bankName: 'Postbank', bic: 'PBNKDEFFXXX' },
  '59010066': { bankName: 'Postbank', bic: 'PBNKDEFFXXX' },
  '60010070': { bankName: 'Postbank', bic: 'PBNKDEFFXXX' },
  '66010075': { bankName: 'Postbank', bic: 'PBNKDEFFXXX' },
  '70010080': { bankName: 'Postbank', bic: 'PBNKDEFFXXX' },
  '76010085': { bankName: 'Postbank', bic: 'PBNKDEFFXXX' },
  '86010090': { bankName: 'Postbank', bic: 'PBNKDEFFXXX' },

  // HypoVereinsbank / UniCredit
  '70020270': { bankName: 'HypoVereinsbank (UniCredit)', bic: 'HYVEDEMMXXX' },
  '20030000': { bankName: 'HypoVereinsbank (UniCredit)', bic: 'HYVEDEMM300' },
  '30020190': { bankName: 'HypoVereinsbank (UniCredit)', bic: 'HYVEDEMM414' },
  '50020200': { bankName: 'HypoVereinsbank (UniCredit)', bic: 'HYVEDEMM437' },

  // Sparda-Banken
  '12096597': { bankName: 'Sparda-Bank Berlin', bic: 'GENODEF1S10' },
  '20690500': { bankName: 'Sparda-Bank Hamburg', bic: 'GENODEF1S11' },
  '25090500': { bankName: 'Sparda-Bank Hannover', bic: 'GENODEF1S09' },
  '37060590': { bankName: 'Sparda-Bank West', bic: 'GENODED1SPW' },
  '50090500': { bankName: 'Sparda-Bank Hessen', bic: 'GENODEF1S12' },
  '55090500': { bankName: 'Sparda-Bank Südwest', bic: 'GENODEF1S01' },
  '60090800': { bankName: 'Sparda-Bank Baden-Württemberg', bic: 'GENODEF1S02' },
  '70090500': { bankName: 'Sparda-Bank München', bic: 'GENODEF1S04' },
  '75090500': { bankName: 'Sparda-Bank Ostbayern', bic: 'GENODEF1S05' },
  '76090500': { bankName: 'Sparda-Bank Nürnberg', bic: 'GENODEF1S06' },

  // Landesbanken & Major Sparkassen
  '10050000': { bankName: 'Berliner Sparkasse', bic: 'BELADEBEXXX' },
  '16050000': { bankName: 'Mittelbrandenburgische Sparkasse', bic: 'WELADED1PMB' },
  '20050550': { bankName: 'Hamburger Sparkasse (Haspa)', bic: 'HASPDEHHXXX' },
  '25050000': { bankName: 'NORD/LB Norddeutsche Landesbank', bic: 'NOLADE2HXXX' },
  '25050180': { bankName: 'Sparkasse Hannover', bic: 'SPKHDE2HXXX' },
  '29050101': { bankName: 'Sparkasse Bremen', bic: 'SBREDE22XXX' },
  '30050000': { bankName: 'Landesbank Hessen-Thüringen (Helaba)', bic: 'WELADEDDXXX' },
  '30050110': { bankName: 'Stadtsparkasse Düsseldorf', bic: 'DUSSDEDDXXX' },
  '36050105': { bankName: 'Sparkasse Essen', bic: 'SPESDE3EXXX' },
  '37050198': { bankName: 'Sparkasse KölnBonn', bic: 'COLSDE33XXX' },
  '37050299': { bankName: 'Kreissparkasse Köln', bic: 'COKSDE33XXX' },
  '39050000': { bankName: 'Sparkasse Aachen', bic: 'AACSDE33XXX' },
  '40050150': { bankName: 'Sparkasse Münsterland Ost', bic: 'WELADED1MST' },
  '44050199': { bankName: 'Sparkasse Dortmund', bic: 'DORTDE33XXX' },
  '50050000': { bankName: 'Landesbank Hessen-Thüringen (Helaba)', bic: 'HELADEFFXXX' },
  '50050201': { bankName: 'Frankfurter Sparkasse (1822direkt)', bic: 'HELADEF1822' },
  '51050015': { bankName: 'Nassauische Sparkasse (Naspa)', bic: 'NASSDE55XXX' },
  '60050101': { bankName: 'BW-Bank / LBBW', bic: 'SOLADEST600' },
  '66050101': { bankName: 'Sparkasse Karlsruhe', bic: 'KARSDE66XXX' },
  '70050000': { bankName: 'Bayerische Landesbank (BayernLB)', bic: 'BYLADEMMXXX' },
  '70150000': { bankName: 'Stadtsparkasse München', bic: 'SSKMDEMMXXX' },
  '70250150': { bankName: 'Kreissparkasse München Starnberg Ebersberg', bic: 'BYLADEM1KMS' },
  '76050101': { bankName: 'Sparkasse Nürnberg', bic: 'SSKNDE77XXX' },
  '85050300': { bankName: 'Ostsächsische Sparkasse Dresden', bic: 'OSDDDE81XXX' },
  '86055592': { bankName: 'Sparkasse Leipzig', bic: 'WELADE8LXXX' },

  // Major Volksbanken & Raiffeisenbanken
  '10090000': { bankName: 'Berliner Volksbank', bic: 'BEVODEBBXXX' },
  '20190003': { bankName: 'Hamburger Volksbank', bic: 'GENODEF1HH2' },
  '25190001': { bankName: 'Hannoversche Volksbank', bic: 'VOHADE2HXXX' },
  '37160087': { bankName: 'Volksbank Köln Bonn', bic: 'GENODED1KBN' },
  '44160014': { bankName: 'Dortmunder Volksbank', bic: 'GENODEM1DOR' },
  '50190000': { bankName: 'Frankfurter Volksbank Rhein/Main', bic: 'FFVBDEFFXXX' },
  '60090100': { bankName: 'Volksbank Stuttgart', bic: 'VOBADESSXXX' },
  '70190000': { bankName: 'Münchner Bank', bic: 'GENODEF1M01' },
};

// Austrian 5-digit BLZ -> { bankName, bic }
const AT_BLZ_DIRECTORY = {
  '12000': { bankName: 'UniCredit Bank Austria', bic: 'BKAUATWWXXX' },
  '14000': { bankName: 'BAWAG P.S.K.', bic: 'BAWAATWWXXX' },
  '60000': { bankName: 'BAWAG P.S.K.', bic: 'BAWAATWWXXX' },
  '14200': { bankName: 'easybank', bic: 'EASYATW1XXX' },
  '15000': { bankName: 'Oberbank', bic: 'OBKLAT2LXXX' },
  '16000': { bankName: 'BTV Vier Länder Bank', bic: 'BTVAAT22XXX' },
  '17000': { bankName: 'BKS Bank', bic: 'BFKKAT2KXXX' },
  '19210': { bankName: 'DADAT / Schelhammer Capital Bank', bic: 'BSSWATWWXXX' },
  '20111': { bankName: 'Erste Bank der oesterreichischen Sparkassen', bic: 'GIBAATWWXXX' },
  '20228': { bankName: 'Sparkasse Niederösterreich Mitte West', bic: 'SPSPAT21XXX' },
  '20320': { bankName: 'Allgemeine Sparkasse Oberösterreich', bic: 'ASPKAT2LXXX' },
  '20404': { bankName: 'Salzburger Sparkasse', bic: 'SBGSAT2SXXX' },
  '20503': { bankName: 'Tiroler Sparkasse', bic: 'SPIHAT22XXX' },
  '20706': { bankName: 'Kärntner Sparkasse', bic: 'KSPKAT2KXXX' },
  '20815': { bankName: 'Steiermärkische Bank und Sparkassen', bic: 'STSPAT2GXXX' },
  '31000': { bankName: 'Raiffeisen Bank International', bic: 'RZBAATWWXXX' },
  '32000': { bankName: 'Raiffeisenlandesbank Niederösterreich-Wien', bic: 'RLNWATWWXXX' },
  '33000': { bankName: 'Raiffeisenlandesbank Burgenland', bic: 'RLBBAT2EXXX' },
  '34000': { bankName: 'Raiffeisenlandesbank Oberösterreich', bic: 'RZOOAT2LXXX' },
  '35000': { bankName: 'Raiffeisenverband Salzburg', bic: 'RVSAAT2SXXX' },
  '36000': { bankName: 'Raiffeisen-Landesbank Tirol', bic: 'RZTIAT22XXX' },
  '37000': { bankName: 'Raiffeisenlandesbank Vorarlberg', bic: 'RVVGAT2BXXX' },
  '38000': { bankName: 'Raiffeisen-Landesbank Steiermark', bic: 'RZSTAT2GXXX' },
  '39000': { bankName: 'Raiffeisen Landesbank Kärnten', bic: 'RZKTAT2KXXX' },
  '43000': { bankName: 'Volksbank Wien', bic: 'VBOEATWWXXX' },
};

// Swiss 5-digit IID -> { bankName, bic }
const CH_IID_DIRECTORY = {
  '09000': { bankName: 'PostFinance', bic: 'POFICHBEXXX' },
  '00700': { bankName: 'Zürcher Kantonalbank (ZKB)', bic: 'ZKBKCHZZ80A' },
  '00790': { bankName: 'Berner Kantonalbank (BEKB)', bic: 'KBBECH22XXX' },
  '00761': { bankName: 'Aargauische Kantonalbank', bic: 'AKBKCH22XXX' },
  '00769': { bankName: 'Basellandschaftliche Kantonalbank', bic: 'BLKBCH22XXX' },
  '00770': { bankName: 'Basler Kantonalbank', bic: 'BKBBCHBBXXX' },
  '00778': { bankName: 'Luzerner Kantonalbank', bic: 'LUKBCH2260A' },
  '00781': { bankName: 'St.Galler Kantonalbank', bic: 'SGKBCH22XXX' },
  '08401': { bankName: 'Migros Bank', bic: 'MIGRCHZZXXX' },
  '08307': { bankName: 'Hypothekarbank Lenzburg (neon)', bic: 'HYPLCH22XXX' },
  '08573': { bankName: 'Bank Cler (Zak)', bic: 'BCLRCHBBXXX' },
};

// Dutch 4-letter Bank Code -> { bankName, bic }
const NL_BANK_DIRECTORY = {
  INGB: { bankName: 'ING Bank', bic: 'INGBNL2AXXX' },
  ABNA: { bankName: 'ABN AMRO', bic: 'ABNANL2AXXX' },
  RABO: { bankName: 'Rabobank', bic: 'RABONL2UXXX' },
  BUNQ: { bankName: 'bunq', bic: 'BUNQNL2AXXX' },
  SNSB: { bankName: 'SNS Bank', bic: 'SNSBNL2AXXX' },
  ASNB: { bankName: 'ASN Bank', bic: 'ASNBNL21XXX' },
  TRIO: { bankName: 'Triodos Bank', bic: 'TRIONL2UXXX' },
  KNAB: { bankName: 'Knab', bic: 'KNABNL2HXXX' },
  REVO: { bankName: 'Revolut', bic: 'REVOLT21XXX' },
};

// Spanish 4-digit Entity Code -> { bankName, bic }
const ES_BANK_DIRECTORY = {
  '0049': { bankName: 'Banco Santander', bic: 'BSCHESMMXXX' },
  '0182': { bankName: 'BBVA', bic: 'BBVAESMMXXX' },
  '2100': { bankName: 'CaixaBank', bic: 'CAIXESBBXXX' },
  '1465': { bankName: 'ING España', bic: 'INGDESMMXXX' },
  '0081': { bankName: 'Banco Sabadell', bic: 'BSABESBBXXX' },
  '0128': { bankName: 'Bankinter', bic: 'BKBKESMMXXX' },
  '0073': { bankName: 'Openbank', bic: 'OPENESMMXXX' },
  '1563': { bankName: 'N26 España', bic: 'NTSBESM1XXX' },
};

// French 5-digit Code Banque -> { bankName, bic }
const FR_BANK_DIRECTORY = {
  '30004': { bankName: 'BNP Paribas', bic: 'BNPAFRPPXXX' },
  '30003': { bankName: 'Société Générale', bic: 'SOGEFRPPXXX' },
  '30002': { bankName: 'LCL (Le Crédit Lyonnais)', bic: 'CRLYFRPPXXX' },
  '20041': { bankName: 'La Banque Postale', bic: 'PSSTFRPPXXX' },
  '40618': { bankName: 'BoursoBank (Boursorama)', bic: 'BOUSFRPPXXX' },
  '10278': { bankName: 'Crédit Mutuel', bic: 'CMCIFR2AXXX' },
  '30066': { bankName: 'CIC (Crédit Industriel et Commercial)', bic: 'CMCIFRPPXXX' },
};

const DE_CLEARING_REGIONS = {
  '1': 'Berlin / Brandenburg / Mecklenburg-Vorpommern',
  '2': 'Hamburg / Niedersachsen / Bremen / Schleswig-Holstein',
  '3': 'Rheinland / Nordrhein-Westfalen',
  '4': 'Westfalen',
  '5': 'Hessen / Rheinland-Pfalz / Saarland',
  '6': 'Baden-Württemberg',
  '7': 'Bayern',
  '8': 'Sachsen / Thüringen / Sachsen-Anhalt',
};

export function normalizeIban(iban) {
  return String(iban || '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(0, 34);
}

export function formatIban(iban, maskMiddle = false) {
  const clean = normalizeIban(iban);
  if (!clean) return '';

  if (maskMiddle && clean.length >= 10) {
    const prefix = clean.slice(0, 4);
    const suffix = clean.slice(-4);
    return `${prefix} •••• •••• ${suffix}`;
  }

  return clean.replace(/(.{4})/g, '$1 ').trim();
}

export function validateIban(iban) {
  const clean = normalizeIban(iban);
  if (clean.length < 2) {
    return {
      isChecked: false,
      isValid: false,
      country: '',
      expectedLength: null,
      currentLength: clean.length,
      formatted: '',
    };
  }

  const country = clean.slice(0, 2);
  const expectedLength = IBAN_COUNTRY_LENGTHS[country] || null;

  if (clean.length < 15) {
    return {
      isChecked: false,
      isValid: false,
      country,
      expectedLength,
      currentLength: clean.length,
      formatted: formatIban(clean, false),
    };
  }

  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]+$/.test(clean)) {
    return {
      isChecked: true,
      isValid: false,
      country,
      expectedLength,
      currentLength: clean.length,
      formatted: formatIban(clean, false),
    };
  }

  if (expectedLength && clean.length !== expectedLength) {
    return {
      isChecked: clean.length >= expectedLength,
      isValid: false,
      country,
      expectedLength,
      currentLength: clean.length,
      formatted: formatIban(clean, false),
    };
  }

  // ISO 7064 Mod 97-10 calculation
  const rearranged = clean.slice(4) + clean.slice(0, 4);
  let numericStr = '';
  for (let i = 0; i < rearranged.length; i++) {
    const code = rearranged.charCodeAt(i);
    if (code >= 65 && code <= 90) {
      numericStr += String(code - 55); // A=10 ... Z=35
    } else {
      numericStr += rearranged[i];
    }
  }

  let remainder = 0;
  for (let i = 0; i < numericStr.length; i += 7) {
    const chunk = String(remainder) + numericStr.slice(i, i + 7);
    remainder = parseInt(chunk, 10) % 97;
  }

  const isValid = remainder === 1;
  return {
    isChecked: true,
    isValid,
    country,
    expectedLength,
    currentLength: clean.length,
    formatted: formatIban(clean, false),
  };
}

/**
 * Instant synchronous offline bank & BIC lookup from an IBAN.
 * Works as soon as the country code + bank code / BLZ digits are typed!
 */
export function lookupBankByIban(iban) {
  const clean = normalizeIban(iban);
  const validation = validateIban(clean);
  if (clean.length < 8) {
    return {
      detected: false,
      exactMatch: false,
      country: clean.slice(0, 2),
      bankCode: '',
      bankName: '',
      bic: '',
      validation,
    };
  }

  const country = clean.slice(0, 2);

  // 1. Germany (DE): 8-digit BLZ at index 4..12
  if (country === 'DE' && clean.length >= 12) {
    const blz = clean.slice(4, 12);
    if (DE_BLZ_DIRECTORY[blz]) {
      return {
        detected: true,
        exactMatch: true,
        country,
        bankCode: blz,
        bankName: DE_BLZ_DIRECTORY[blz].bankName,
        bic: DE_BLZ_DIRECTORY[blz].bic,
        validation,
      };
    }

    // Check German BLZ structural rules (4th digit = Bankengruppe)
    const clearingRegionDigit = blz[0];
    const bankGroupDigit = blz[3];
    const regionLabel = DE_CLEARING_REGIONS[clearingRegionDigit] || '';

    if (bankGroupDigit === '5') {
      return {
        detected: true,
        exactMatch: false,
        country,
        bankCode: blz,
        bankName: regionLabel ? `Sparkasse (${regionLabel.split(' / ')[0]})` : 'Sparkasse',
        bic: '',
        validation,
      };
    }

    if (bankGroupDigit === '9' || bankGroupDigit === '6') {
      return {
        detected: true,
        exactMatch: false,
        country,
        bankCode: blz,
        bankName: 'Volksbank / Raiffeisenbank',
        bic: '',
        validation,
      };
    }

    if (bankGroupDigit === '1' && blz.slice(4, 6) === '00') {
      return {
        detected: true,
        exactMatch: true,
        country,
        bankCode: blz,
        bankName: 'Postbank',
        bic: 'PBNKDEFFXXX',
        validation,
      };
    }

    if (bankGroupDigit === '4' && blz.slice(4, 6) === '00') {
      return {
        detected: true,
        exactMatch: true,
        country,
        bankCode: blz,
        bankName: 'Commerzbank',
        bic: 'COBADEFFXXX',
        validation,
      };
    }

    if (bankGroupDigit === '7' && blz.slice(4, 6) === '00') {
      return {
        detected: true,
        exactMatch: true,
        country,
        bankCode: blz,
        bankName: 'Deutsche Bank',
        bic: 'DEUTDEFFXXX',
        validation,
      };
    }

    if (bankGroupDigit === '0' && blz === '10000000') {
      return {
        detected: true,
        exactMatch: true,
        country,
        bankCode: blz,
        bankName: 'Deutsche Bundesbank',
        bic: 'MARKDEF1100',
        validation,
      };
    }
  }

  // 2. Austria (AT): 5-digit BLZ at index 4..9
  if (country === 'AT' && clean.length >= 9) {
    const blz = clean.slice(4, 9);
    if (AT_BLZ_DIRECTORY[blz]) {
      return {
        detected: true,
        exactMatch: true,
        country,
        bankCode: blz,
        bankName: AT_BLZ_DIRECTORY[blz].bankName,
        bic: AT_BLZ_DIRECTORY[blz].bic,
        validation,
      };
    }
    if (blz.startsWith('20')) {
      return {
        detected: true,
        exactMatch: false,
        country,
        bankCode: blz,
        bankName: 'Sparkasse / Erste Bank (AT)',
        bic: 'GIBAATWWXXX',
        validation,
      };
    }
    if (blz.startsWith('3')) {
      return {
        detected: true,
        exactMatch: false,
        country,
        bankCode: blz,
        bankName: 'Raiffeisenbank (AT)',
        bic: '',
        validation,
      };
    }
    if (blz.startsWith('4')) {
      return {
        detected: true,
        exactMatch: false,
        country,
        bankCode: blz,
        bankName: 'Volksbank (AT)',
        bic: 'VBOEATWWXXX',
        validation,
      };
    }
  }

  // 3. Switzerland & Liechtenstein (CH / LI): 5-digit IID at index 4..9
  if ((country === 'CH' || country === 'LI') && clean.length >= 9) {
    const iid = clean.slice(4, 9);
    if (CH_IID_DIRECTORY[iid]) {
      return {
        detected: true,
        exactMatch: true,
        country,
        bankCode: iid,
        bankName: CH_IID_DIRECTORY[iid].bankName,
        bic: CH_IID_DIRECTORY[iid].bic,
        validation,
      };
    }
    if (iid.startsWith('002')) {
      return {
        detected: true,
        exactMatch: true,
        country,
        bankCode: iid,
        bankName: 'UBS Switzerland',
        bic: 'UBSWCHZH80A',
        validation,
      };
    }
    if (iid.startsWith('048') || iid.startsWith('004')) {
      return {
        detected: true,
        exactMatch: true,
        country,
        bankCode: iid,
        bankName: 'Credit Suisse (UBS)',
        bic: 'CRESCHZZ80A',
        validation,
      };
    }
    if (iid.startsWith('80') || iid.startsWith('81')) {
      return {
        detected: true,
        exactMatch: true,
        country,
        bankCode: iid,
        bankName: 'Raiffeisen Schweiz',
        bic: 'RAIFCH22XXX',
        validation,
      };
    }
    if (iid.startsWith('007')) {
      return {
        detected: true,
        exactMatch: false,
        country,
        bankCode: iid,
        bankName: 'Kantonalbank (CH)',
        bic: '',
        validation,
      };
    }
  }

  // 4. Netherlands (NL): 4-letter bank code at index 4..8
  if (country === 'NL' && clean.length >= 8) {
    const bankCode = clean.slice(4, 8);
    if (NL_BANK_DIRECTORY[bankCode]) {
      return {
        detected: true,
        exactMatch: true,
        country,
        bankCode,
        bankName: NL_BANK_DIRECTORY[bankCode].bankName,
        bic: NL_BANK_DIRECTORY[bankCode].bic,
        validation,
      };
    }
  }

  // 5. Spain (ES): 4-digit entity code at index 4..8
  if (country === 'ES' && clean.length >= 8) {
    const bankCode = clean.slice(4, 8);
    if (ES_BANK_DIRECTORY[bankCode]) {
      return {
        detected: true,
        exactMatch: true,
        country,
        bankCode,
        bankName: ES_BANK_DIRECTORY[bankCode].bankName,
        bic: ES_BANK_DIRECTORY[bankCode].bic,
        validation,
      };
    }
  }

  // 6. France (FR): 5-digit bank code at index 4..9
  if (country === 'FR' && clean.length >= 9) {
    const bankCode = clean.slice(4, 9);
    if (FR_BANK_DIRECTORY[bankCode]) {
      return {
        detected: true,
        exactMatch: true,
        country,
        bankCode,
        bankName: FR_BANK_DIRECTORY[bankCode].bankName,
        bic: FR_BANK_DIRECTORY[bankCode].bic,
        validation,
      };
    }
  }

  return {
    detected: false,
    exactMatch: false,
    country,
    bankCode: '',
    bankName: '',
    bic: '',
    validation,
  };
}

/**
 * Optional online lookup (non-blocking) for regional Sparkassen/Volksbanken/EU banks
 * when the user has a valid complete IBAN that isn't in the static offline exact list.
 */
const onlineIbanCache = new Map();

export async function lookupBankByIbanOnline(iban) {
  const clean = normalizeIban(iban);
  const local = lookupBankByIban(clean);
  if (!local.validation.isValid) {
    return local;
  }
  if (local.exactMatch && local.bic && local.bankName) {
    return local;
  }
  if (onlineIbanCache.has(clean)) {
    return onlineIbanCache.get(clean);
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2800);
    const res = await fetch(
      `https://openiban.com/validate/${encodeURIComponent(clean)}?getBIC=true&validateBankCode=true`,
      { signal: controller.signal }
    );
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      if (data && data.bankData && (data.bankData.name || data.bankData.bic)) {
        const enriched = {
          ...local,
          detected: true,
          exactMatch: true,
          bankCode: data.bankData.bankCode || local.bankCode,
          bankName: data.bankData.name || local.bankName,
          bic: data.bankData.bic || local.bic,
        };
        onlineIbanCache.set(clean, enriched);
        return enriched;
      }
    }
  } catch {
    // Offline or timeout - gracefully return local detection result
  }

  return local;
}
