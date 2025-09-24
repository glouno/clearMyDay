// Complete list of Sorbonne University Master Computer Science programs
// Based on: https://sciences.sorbonne-universite.fr/en/study/degree-seeking/masters/master-computer-science

import { SorborneCalendarSource } from './types';

export const ALL_SORBONNE_MASTERS: Record<string, SorborneCalendarSource> = {
  // ===== EXISTING MASTERS (confirmed working) =====
  DAC: {
    id: 'DAC',
    name: 'M1 DAC (Data, Apprentissage, Connaissances)',
    url: 'https://cal.ufr-info-p6.jussieu.fr/caldav.php/DAC/M1_DAC',
    courses: ['DALAS', 'LRC', 'MLBDA'],
    defaultGroups: { td: '5', tme: 'B' }
  },
  IMA: {
    id: 'IMA',
    name: 'M1 IMA (Informatique Médicale et Applications)',
    url: 'https://cal.ufr-info-p6.jussieu.fr/caldav.php/IMA/M1_IMA',
    courses: ['MAPSI'],
    defaultGroups: { td: '5' }
  },
  ANDROIDE: {
    id: 'ANDROIDE',
    name: 'M1 ANDROIDE (Agents Distribués, Robotique, Recherche Opérationnelle, Interaction, Décision)',
    url: 'https://cal.ufr-info-p6.jussieu.fr/caldav.php/ANDROIDE/M1_ANDROIDE',
    courses: ['MOGPL'],
    defaultGroups: {}
  },

  // ===== NEW MASTERS (to be tested) =====
  AI2D: {
    id: 'AI2D',
    name: 'M1 AI2D (Artificial Intelligence, Algorithms, Interactions and Decision-making)',
    url: 'https://cal.ufr-info-p6.jussieu.fr/caldav.php/AI2D/M1_AI2D',
    courses: [], // To be discovered
    defaultGroups: {}
  },
  BIM: {
    id: 'BIM',
    name: 'M1 BIM (Bio-Informatics and Modeling)',
    url: 'https://cal.ufr-info-p6.jussieu.fr/caldav.php/BIM/M1_BIM',
    courses: [], // To be discovered
    defaultGroups: {}
  },
  CCA: {
    id: 'CCA',
    name: 'M1 CCA (Cryptology, High Performance Computing and Algorithmics)',
    url: 'https://cal.ufr-info-p6.jussieu.fr/caldav.php/CCA/M1_CCA',
    courses: [], // To be discovered
    defaultGroups: {}
  },
  MIND: {
    id: 'MIND',
    name: 'M1 MIND (Machine learning, artificial INtelligence and Data)',
    url: 'https://cal.ufr-info-p6.jussieu.fr/caldav.php/MIND/M1_MIND',
    courses: [], // To be discovered
    defaultGroups: {}
  },
  QI: {
    id: 'QI',
    name: 'M1 QI (Quantum Information)',
    url: 'https://cal.ufr-info-p6.jussieu.fr/caldav.php/QI/M1_QI',
    courses: [], // To be discovered
    defaultGroups: {}
  },
  RES: {
    id: 'RES',
    name: 'M1 RES (Computer Networks: Internet, Cybersecurity, Cloud and Automation)',
    url: 'https://cal.ufr-info-p6.jussieu.fr/caldav.php/RES/M1_RES',
    courses: [], // To be discovered
    defaultGroups: {}
  },
  SAR: {
    id: 'SAR',
    name: 'M1 SAR (Distributed Systems and Applications)',
    url: 'https://cal.ufr-info-p6.jussieu.fr/caldav.php/SAR/M1_SAR',
    courses: [], // To be discovered
    defaultGroups: {}
  },
  SESI: {
    id: 'SESI',
    name: 'M1 SESI (Electronic Systems and Computer Systems)',
    url: 'https://cal.ufr-info-p6.jussieu.fr/caldav.php/SESI/M1_SESI',
    courses: [], // To be discovered
    defaultGroups: {}
  },
  STL: {
    id: 'STL',
    name: 'M1 STL (Software Science and Technology)',
    url: 'https://cal.ufr-info-p6.jussieu.fr/caldav.php/STL/M1_STL',
    courses: [], // To be discovered
    defaultGroups: {}
  },
  DIGIT: {
    id: 'DIGIT',
    name: 'M1 DIGIT (International Program)',
    url: 'https://cal.ufr-info-p6.jussieu.fr/caldav.php/DIGIT/M1_DIGIT',
    courses: [], // To be discovered
    defaultGroups: {}
  },
  HPC: {
    id: 'HPC',
    name: 'M1 HPC (High Performance Computing)',
    url: 'https://cal.ufr-info-p6.jussieu.fr/caldav.php/HPC/M1_HPC',
    courses: [], // To be discovered
    defaultGroups: {}
  },

  // ===== M2 MASTERS (if they exist) =====
  DAC_M2: {
    id: 'DAC_M2',
    name: 'M2 DAC (Data, Apprentissage, Connaissances)',
    url: 'https://cal.ufr-info-p6.jussieu.fr/caldav.php/DAC/M2_DAC',
    courses: [], // To be discovered
    defaultGroups: {}
  },
  IMA_M2: {
    id: 'IMA_M2',
    name: 'M2 IMA (Informatique Médicale et Applications)',
    url: 'https://cal.ufr-info-p6.jussieu.fr/caldav.php/IMA/M2_IMA',
    courses: [], // To be discovered
    defaultGroups: {}
  }
};

// Subset of confirmed working masters (for production)
export const CONFIRMED_MASTERS: Record<string, SorborneCalendarSource> = {
  DAC: ALL_SORBONNE_MASTERS.DAC,
  IMA: ALL_SORBONNE_MASTERS.IMA,
  ANDROIDE: ALL_SORBONNE_MASTERS.ANDROIDE
};

// Function to test if a CalDAV URL is accessible
export async function testCalDAVEndpoint(master: SorborneCalendarSource): Promise<boolean> {
  try {
    const response = await fetch(master.url, {
      method: 'PROPFIND',
      headers: {
        'Authorization': 'Basic ' + btoa('student.master:guest'),
        'Content-Type': 'application/xml',
        'Depth': '1'
      },
      body: `<?xml version="1.0" encoding="utf-8" ?>
        <D:propfind xmlns:D="DAV:">
          <D:prop>
            <D:displayname/>
            <D:resourcetype/>
          </D:prop>
        </D:propfind>`
    });
    
    return response.status === 207; // Multi-Status response indicates success
  } catch (error) {
    console.error(`Failed to test ${master.id}:`, error);
    return false;
  }
}

// Function to discover available courses for a master
export async function discoverCourses(master: SorborneCalendarSource): Promise<string[]> {
  try {
    // This would require implementing ICS parsing to extract course names
    // For now, return empty array - courses will be discovered through usage
    return [];
  } catch (error) {
    console.error(`Failed to discover courses for ${master.id}:`, error);
    return [];
  }
}
