// Complete list of Sorbonne University Master Computer Science programs
// Based on: https://sciences.sorbonne-universite.fr/en/study/degree-seeking/masters/master-computer-science

import { SorborneCalendarSource } from './types';

export const ALL_SORBONNE_MASTERS: Record<string, SorborneCalendarSource> = {
  // ===== M1 MASTERS =====
  DAC: {
    id: 'DAC',
    name: 'M1 MIND/DAC (Machine Learning, Artificial Intelligence and Data / Data, Apprentissage, Connaissances)',
    url: 'https://student.master:guest@cal.ufr-info-p6.jussieu.fr/caldav.php/DAC/M1_DAC',
    courses: ['DALAS', 'LRC', 'MLBDA', 'SAM', 'IAMSI', 'ML', 'MLL', 'RITAL', 'IDLE', 'ANGLAIS'],
    defaultGroups: { td: '5', tme: 'B' }
  },
  IMA: {
    id: 'IMA',
    name: 'M1 IMA (Informatique Médicale et Applications)',
    url: 'https://student.master:guest@cal.ufr-info-p6.jussieu.fr/caldav.php/IMA/M1_IMA',
    courses: ['BIMA', 'MAPSI', 'IG3D'],
    defaultGroups: { td: '5' }
  },
  ANDROIDE: {
    id: 'ANDROIDE',
    name: 'M1 AI2D/ANDROIDE (Artificial Intelligence, Algorithms, Interactions and Decision-making / Agents Distribués, Robotique, Recherche Opérationnelle, Interaction, Décision)',
    url: 'https://student.master:guest@cal.ufr-info-p6.jussieu.fr/caldav.php/ANDROIDE/M1_ANDROIDE',
    courses: ['MOGPL', 'IREC', 'RP', 'FOSYMA', 'FO_SY_MA', 'IHM', 'DJ', 'AROB'],
    defaultGroups: {}
  },
  BIM: {
    id: 'BIM',
    name: 'M1 BIM (Bio-Informatics and Modeling)',
    url: 'https://student.master:guest@cal.ufr-info-p6.jussieu.fr/caldav.php/BIM/M1_BIM',
    courses: ['SDED', 'AAGB', 'SBAS', 'MMCN', 'DEEPLIFE', 'DEEP_LIFE'],
    defaultGroups: {}
  },
  SFPN: {
    id: 'SFPN',
    name: 'M1 CCA/SFPN (Cryptology, High Performance Computing and Algorithmics)',
    url: 'https://student.master:guest@cal.ufr-info-p6.jussieu.fr/caldav.php/SFPN/M1_SFPN',
    courses: ['MODEL', 'COMPLEX', 'PPAR', 'FLAG', 'CRYPTO1', 'ANUM', 'ANUM2'],
    defaultGroups: {}
  },
  IQ: {
    id: 'IQ',
    name: 'M1 IQ (Quantum Information)',
    url: 'https://student.master:guest@cal.ufr-info-p6.jussieu.fr/caldav.php/IQ/M1_IQ',
    courses: ['BQPh', 'QCQC', 'QPh4CS', 'QPH4CS', 'THEORIE_DE_SHANNON', 'QIOV', 'PQIAS'],
    defaultGroups: {}
  },
  RES: {
    id: 'RES',
    name: 'M1 RES (Computer Networks: Internet, Cybersecurity, Cloud and Automation)',
    url: 'https://student.master:guest@cal.ufr-info-p6.jussieu.fr/caldav.php/RES/M1_RES',
    courses: ['RTEL', 'ARES', 'PROGRES', 'ALGORES', 'COMNUM', 'MOB', 'CRV'],
    defaultGroups: {}
  },
  SAR: {
    id: 'SAR',
    name: 'M1 SAR (Distributed Systems and Applications)',
    url: 'https://student.master:guest@cal.ufr-info-p6.jussieu.fr/caldav.php/SAR/M1_SAR',
    courses: ['PSCR', 'NOYAU', 'PNL', 'AR', 'SRCS', 'SFTR'],
    defaultGroups: {}
  },
  SESI: {
    id: 'SESI',
    name: 'M1 SESI (Electronic Systems and Computer Systems)',
    url: 'https://student.master:guest@cal.ufr-info-p6.jussieu.fr/caldav.php/SESI/M1_SESI',
    courses: ['VLSI1', 'SIGNAL', 'MOBJ', 'ARCHI1', 'ESA', 'MULTI', 'FPGA', 'IOC', 'EACN'],
    defaultGroups: {}
  },
  STL: {
    id: 'STL',
    name: 'M1 STL (Software Science and Technology)',
    url: 'https://student.master:guest@cal.ufr-info-p6.jussieu.fr/caldav.php/STL/M1_STL',
    courses: ['ALGAV', 'OUV', 'LS', 'DLP', 'APS', 'CA', 'CPA', 'CPS', 'PC3R', 'PAF'],
    defaultGroups: {}
  },
  HPC: {
    id: 'HPC',
    name: 'M1 HPC (High Performance Computing)',
    url: 'https://student.master:guest@cal.ufr-info-p6.jussieu.fr/caldav.php/HPC/M1_HPC',
    courses: [],
    defaultGroups: {}
  },

  // ===== M2 MASTERS (accessible ones) =====
  DAC_M2: {
    id: 'DAC_M2',
    name: 'M2 MIND/DAC (Machine Learning, Artificial Intelligence and Data / Data, Apprentissage, Connaissances)',
    url: 'https://student.master:guest@cal.ufr-info-p6.jussieu.fr/caldav.php/DAC/M2_DAC',
    courses: ['BDLE', 'AMAL', 'RLD', 'REDS', 'LODAS', 'AS', 'XAI', 'FDMS', 'RI', 'CI', 'LSDA', 'MEDS', 'ASWS', 'SACE', 'ADL', 'GDC', 'RL', 'ORACOI', 'DEEP', 'LMM', 'OIP'],
    defaultGroups: {}
  },
  IMA_M2: {
    id: 'IMA_M2',
    name: 'M2 IMA (Informatique Médicale et Applications)',
    url: 'https://student.master:guest@cal.ufr-info-p6.jussieu.fr/caldav.php/IMA/M2_IMA',
    courses: ['RDFIA', 'TADI', 'BIOMED', 'VISION', 'APIMED', 'PRAT', 'DA', 'OIP'],
    defaultGroups: {}
  },
  ANDROIDE_M2: {
    id: 'ANDROIDE_M2',
    name: 'M2 AI2D/ANDROIDE (Artificial Intelligence, Algorithms, Interactions and Decision-making / Agents Distribués, Robotique, Recherche Opérationnelle, Interaction, Décision)',
    url: 'https://student.master:guest@cal.ufr-info-p6.jussieu.fr/caldav.php/ANDROIDE/M2_ANDROIDE',
    courses: ['IAR', 'COCOMA', 'MADMC', 'AOTJ', 'MAOA', 'MADI', 'MOSIMA', 'ISG', 'EVIH', 'AI', 'OIP'],
    defaultGroups: {}
  },
  BIM_M2: {
    id: 'BIM_M2',
    name: 'M2 BIM (Bio-Informatics and Modeling)',
    url: 'https://student.master:guest@cal.ufr-info-p6.jussieu.fr/caldav.php/BIM/M2_BIM',
    courses: ['GPOP', 'GROP', 'STRUCT', 'PHYG', 'RESYS', 'SPLEX', 'GENOM', 'OIP'],
    defaultGroups: {}
  },
  RES_M2: {
    id: 'RES_M2',
    name: 'M2 RES (Computer Networks: Internet, Cybersecurity, Cloud and Automation)',
    url: 'https://student.master:guest@cal.ufr-info-p6.jussieu.fr/caldav.php/RES/M2_RES',
    courses: ['SECRES', 'NEVA', 'ITQOS', 'CELL', 'ANET', 'NETMET', 'NAM', 'MEPS', 'NDA', 'IGOV', 'DAAR', 'METHOD', 'OIP'],
    defaultGroups: {}
  },
  SAR_M2: {
    id: 'SAR_M2',
    name: 'M2 SAR (Distributed Systems and Applications)',
    url: 'https://student.master:guest@cal.ufr-info-p6.jussieu.fr/caldav.php/SAR/M2_SAR',
    courses: ['NMV', 'ASTRE', 'ARA', 'PPM', 'DEVREP', 'CODEL', 'SF', 'ACLOUD', 'IDM', 'OIP'],
    defaultGroups: {}
  },
  SESI_M2: {
    id: 'SESI_M2',
    name: 'M2 SESI (Electronic Systems and Computer Systems)',
    url: 'https://student.master:guest@cal.ufr-info-p6.jussieu.fr/caldav.php/SESI/M2_SESI',
    courses: ['MASSOC', 'PBD', 'PROG', 'DSP', 'SMC', 'HOTOP', 'MOCCA', 'COCCA', 'PACC', 'IMSE', 'OIP'],
    defaultGroups: {}
  },
  STL_M2: {
    id: 'STL_M2',
    name: 'M2 STL (Software Science and Technology)',
    url: 'https://student.master:guest@cal.ufr-info-p6.jussieu.fr/caldav.php/STL/M2_STL',
    courses: ['TAS', 'PPC', 'DAAR', 'AAGA', 'ALASCA', 'PISTL', 'TPEA', 'RECH', 'GRAPA', 'DAR', 'GPSTL', 'SVP', 'OIP'],
    defaultGroups: {}
  },
  SFPN_M2: {
    id: 'SFPN_M2',
    name: 'M2 CCA/SFPN (Cryptology, High Performance Computing and Algorithmics)',
    url: 'https://student.master:guest@cal.ufr-info-p6.jussieu.fr/caldav.php/SFPN/M2_SFPN',
    courses: ['HPCA', 'CRYPTA', 'SCA', 'POSSO', 'AFAE', 'OIP'],
    defaultGroups: {}
  },
  IQ_M2: {
    id: 'IQ_M2',
    name: 'M2 IQ (Quantum Information)',
    url: 'https://student.master:guest@cal.ufr-info-p6.jussieu.fr/caldav.php/IQ/M2_IQ',
    courses: ['PhQC', 'QIT', 'AQCrypt', 'QCrypt', 'QAlg', 'AQAlg', 'OIP'],
    defaultGroups: {}
  }
};

// Validated masters (Production)
export const CONFIRMED_MASTERS: Record<string, SorborneCalendarSource> = {
  // ===== M1 MASTERS =====
  DAC: ALL_SORBONNE_MASTERS.DAC,
  IMA: ALL_SORBONNE_MASTERS.IMA,
  ANDROIDE: ALL_SORBONNE_MASTERS.ANDROIDE,
  BIM: ALL_SORBONNE_MASTERS.BIM,
  SFPN: ALL_SORBONNE_MASTERS.SFPN,
  IQ: ALL_SORBONNE_MASTERS.IQ,
  RES: ALL_SORBONNE_MASTERS.RES,
  SAR: ALL_SORBONNE_MASTERS.SAR,
  SESI: ALL_SORBONNE_MASTERS.SESI,
  STL: ALL_SORBONNE_MASTERS.STL,

  // ===== M2 MASTERS =====
  DAC_M2: ALL_SORBONNE_MASTERS.DAC_M2,
  IMA_M2: ALL_SORBONNE_MASTERS.IMA_M2,
  ANDROIDE_M2: ALL_SORBONNE_MASTERS.ANDROIDE_M2,
  BIM_M2: ALL_SORBONNE_MASTERS.BIM_M2,
  SFPN_M2: ALL_SORBONNE_MASTERS.SFPN_M2,
  IQ_M2: ALL_SORBONNE_MASTERS.IQ_M2,
  RES_M2: ALL_SORBONNE_MASTERS.RES_M2,
  SAR_M2: ALL_SORBONNE_MASTERS.SAR_M2,
  SESI_M2: ALL_SORBONNE_MASTERS.SESI_M2,
  STL_M2: ALL_SORBONNE_MASTERS.STL_M2
};

// Function to test if a CalDAV URL is accessible
export async function testCalDAVEndpoint(master: SorborneCalendarSource): Promise<boolean> {
  try {
    // Extract URL without embedded auth for fetch (we'll use headers instead)
    const urlWithoutAuth = master.url.replace('student.master:guest@', '');

    const response = await fetch(urlWithoutAuth, {
      method: 'GET', // Simple GET request to test accessibility
      headers: {
        'Authorization': 'Basic ' + btoa('student.master:guest'),
        'User-Agent': 'ClearMyDay/1.0 (Calendar Test)',
        'Accept': 'text/calendar, application/calendar+xml'
      }
    });

    // Accept various success codes for CalDAV
    return response.status === 200 || response.status === 207 || response.status === 302;
  } catch (error) {
    console.error(`Failed to test ${master.id}:`, error);
    return false;
  }
}

// Helper functions for M1/M2 filtering
export function getM1Masters(): Record<string, SorborneCalendarSource> {
  const m1Masters: Record<string, SorborneCalendarSource> = {};

  for (const [key, master] of Object.entries(ALL_SORBONNE_MASTERS)) {
    if (!key.endsWith('_M2')) {
      m1Masters[key] = master;
    }
  }

  return m1Masters;
}

export function getM2Masters(): Record<string, SorborneCalendarSource> {
  const m2Masters: Record<string, SorborneCalendarSource> = {};

  for (const [key, master] of Object.entries(ALL_SORBONNE_MASTERS)) {
    if (key.endsWith('_M2')) {
      m2Masters[key] = master;
    }
  }

  return m2Masters;
}

export function getConfirmedM1Masters(): Record<string, SorborneCalendarSource> {
  const m1Masters: Record<string, SorborneCalendarSource> = {};

  for (const [key, master] of Object.entries(CONFIRMED_MASTERS)) {
    if (!key.endsWith('_M2')) {
      m1Masters[key] = master;
    }
  }

  return m1Masters;
}

export function getConfirmedM2Masters(): Record<string, SorborneCalendarSource> {
  const m2Masters: Record<string, SorborneCalendarSource> = {};

  for (const [key, master] of Object.entries(CONFIRMED_MASTERS)) {
    if (key.endsWith('_M2')) {
      m2Masters[key] = master;
    }
  }

  return m2Masters;
}
