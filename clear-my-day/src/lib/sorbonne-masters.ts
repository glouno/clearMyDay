// Complete list of Sorbonne University Master Computer Science programs
// Based on: https://sciences.sorbonne-universite.fr/en/study/degree-seeking/masters/master-computer-science

import { SorborneCalendarSource } from './types';

export const ALL_SORBONNE_MASTERS: Record<string, SorborneCalendarSource> = {
  // ===== EXISTING MASTERS (confirmed working) =====
  DAC: {
    id: 'DAC',
    name: 'M1 DAC (Data, Apprentissage, Connaissances)',
    url: 'https://student.master:guest@cal.ufr-info-p6.jussieu.fr/caldav.php/DAC/M1_DAC',
    courses: ['DALAS', 'LRC', 'MLBDA'],
    defaultGroups: { td: '5', tme: 'B' }
  },
  IMA: {
    id: 'IMA',
    name: 'M1 IMA (Informatique Médicale et Applications)',
    url: 'https://student.master:guest@cal.ufr-info-p6.jussieu.fr/caldav.php/IMA/M1_IMA',
    courses: ['MAPSI'],
    defaultGroups: { td: '5' }
  },
  ANDROIDE: {
    id: 'ANDROIDE',
    name: 'M1 ANDROIDE (Agents Distribués, Robotique, Recherche Opérationnelle, Interaction, Décision)',
    url: 'https://student.master:guest@cal.ufr-info-p6.jussieu.fr/caldav.php/ANDROIDE/M1_ANDROIDE',
    courses: ['MOGPL'],
    defaultGroups: {}
  },

  // ===== NEW MASTERS (to be tested) =====
  AI2D: {
    id: 'AI2D',
    name: 'M1 AI2D (Artificial Intelligence, Algorithms, Interactions and Decision-making)',
    url: 'https://student.master:guest@cal.ufr-info-p6.jussieu.fr/caldav.php/AI2D/M1_AI2D',
    courses: [], // To be discovered
    defaultGroups: {}
  },
  BIM: {
    id: 'BIM',
    name: 'M1 BIM (Bio-Informatics and Modeling)',
    url: 'https://student.master:guest@cal.ufr-info-p6.jussieu.fr/caldav.php/BIM/M1_BIM',
    courses: [], // To be discovered
    defaultGroups: {}
  },
  CCA: {
    id: 'CCA',
    name: 'M1 CCA (Cryptology, High Performance Computing and Algorithmics)',
    url: 'https://student.master:guest@cal.ufr-info-p6.jussieu.fr/caldav.php/CCA/M1_CCA',
    courses: [], // To be discovered
    defaultGroups: {}
  },
  MIND: {
    id: 'MIND',
    name: 'M1 MIND (Machine learning, artificial INtelligence and Data)',
    url: 'https://student.master:guest@cal.ufr-info-p6.jussieu.fr/caldav.php/MIND/M1_MIND',
    courses: [], // To be discovered
    defaultGroups: {}
  },
  QI: {
    id: 'QI',
    name: 'M1 QI (Quantum Information)',
    url: 'https://student.master:guest@cal.ufr-info-p6.jussieu.fr/caldav.php/QI/M1_QI',
    courses: [], // To be discovered
    defaultGroups: {}
  },
  RES: {
    id: 'RES',
    name: 'M1 RES (Computer Networks: Internet, Cybersecurity, Cloud and Automation)',
    url: 'https://student.master:guest@cal.ufr-info-p6.jussieu.fr/caldav.php/RES/M1_RES',
    courses: [], // To be discovered
    defaultGroups: {}
  },
  SAR: {
    id: 'SAR',
    name: 'M1 SAR (Distributed Systems and Applications)',
    url: 'https://student.master:guest@cal.ufr-info-p6.jussieu.fr/caldav.php/SAR/M1_SAR',
    courses: [], // To be discovered
    defaultGroups: {}
  },
  SESI: {
    id: 'SESI',
    name: 'M1 SESI (Electronic Systems and Computer Systems)',
    url: 'https://student.master:guest@cal.ufr-info-p6.jussieu.fr/caldav.php/SESI/M1_SESI',
    courses: [], // To be discovered
    defaultGroups: {}
  },
  STL: {
    id: 'STL',
    name: 'M1 STL (Software Science and Technology)',
    url: 'https://student.master:guest@cal.ufr-info-p6.jussieu.fr/caldav.php/STL/M1_STL',
    courses: [], // To be discovered
    defaultGroups: {}
  },
  DIGIT: {
    id: 'DIGIT',
    name: 'M1 DIGIT (International Program)',
    url: 'https://student.master:guest@cal.ufr-info-p6.jussieu.fr/caldav.php/DIGIT/M1_DIGIT',
    courses: [], // To be discovered
    defaultGroups: {}
  },
  HPC: {
    id: 'HPC',
    name: 'M1 HPC (High Performance Computing)',
    url: 'https://student.master:guest@cal.ufr-info-p6.jussieu.fr/caldav.php/HPC/M1_HPC',
    courses: [], // To be discovered
    defaultGroups: {}
  },

  // ===== M2 MASTERS (accessible ones) =====
  DAC_M2: {
    id: 'DAC_M2',
    name: 'M2 DAC (Data, Apprentissage, Connaissances)',
    url: 'https://student.master:guest@cal.ufr-info-p6.jussieu.fr/caldav.php/DAC/M2_DAC',
    courses: [], // To be discovered
    defaultGroups: {}
  },
  IMA_M2: {
    id: 'IMA_M2',
    name: 'M2 IMA (Informatique Médicale et Applications)',
    url: 'https://student.master:guest@cal.ufr-info-p6.jussieu.fr/caldav.php/IMA/M2_IMA',
    courses: [], // To be discovered
    defaultGroups: {}
  },
  ANDROIDE_M2: {
    id: 'ANDROIDE_M2',
    name: 'M2 ANDROIDE (Agents Distribués, Robotique, Recherche Opérationnelle, Interaction, Décision)',
    url: 'https://student.master:guest@cal.ufr-info-p6.jussieu.fr/caldav.php/ANDROIDE/M2_ANDROIDE',
    courses: [], // To be discovered
    defaultGroups: {}
  },
  BIM_M2: {
    id: 'BIM_M2',
    name: 'M2 BIM (Bio-Informatics and Modeling)',
    url: 'https://student.master:guest@cal.ufr-info-p6.jussieu.fr/caldav.php/BIM/M2_BIM',
    courses: [], // To be discovered
    defaultGroups: {}
  },
  RES_M2: {
    id: 'RES_M2',
    name: 'M2 RES (Computer Networks: Internet, Cybersecurity, Cloud and Automation)',
    url: 'https://student.master:guest@cal.ufr-info-p6.jussieu.fr/caldav.php/RES/M2_RES',
    courses: [], // To be discovered
    defaultGroups: {}
  },
  SAR_M2: {
    id: 'SAR_M2',
    name: 'M2 SAR (Distributed Systems and Applications)',
    url: 'https://student.master:guest@cal.ufr-info-p6.jussieu.fr/caldav.php/SAR/M2_SAR',
    courses: [], // To be discovered
    defaultGroups: {}
  },
  SESI_M2: {
    id: 'SESI_M2',
    name: 'M2 SESI (Electronic Systems and Computer Systems)',
    url: 'https://student.master:guest@cal.ufr-info-p6.jussieu.fr/caldav.php/SESI/M2_SESI',
    courses: [], // To be discovered
    defaultGroups: {}
  },
  STL_M2: {
    id: 'STL_M2',
    name: 'M2 STL (Software Science and Technology)',
    url: 'https://student.master:guest@cal.ufr-info-p6.jussieu.fr/caldav.php/STL/M2_STL',
    courses: [], // To be discovered
    defaultGroups: {}
  },
  HPC_M2: {
    id: 'HPC_M2',
    name: 'M2 HPC (High Performance Computing)',
    url: 'https://student.master:guest@cal.ufr-info-p6.jussieu.fr/caldav.php/HPC/M2_HPC',
    courses: [], // To be discovered
    defaultGroups: {}
  }
};

// Subset of confirmed working masters (for production)
// Based on accessibility testing - these 11 M1 + 7 M2 masters are confirmed working
export const CONFIRMED_MASTERS: Record<string, SorborneCalendarSource> = {
  // Original confirmed M1 masters
  DAC: ALL_SORBONNE_MASTERS.DAC,
  IMA: ALL_SORBONNE_MASTERS.IMA,
  ANDROIDE: ALL_SORBONNE_MASTERS.ANDROIDE,
  
  // Newly confirmed M1 masters
  BIM: ALL_SORBONNE_MASTERS.BIM,
  RES: ALL_SORBONNE_MASTERS.RES,
  SAR: ALL_SORBONNE_MASTERS.SAR,
  SESI: ALL_SORBONNE_MASTERS.SESI,
  STL: ALL_SORBONNE_MASTERS.STL,
  HPC: ALL_SORBONNE_MASTERS.HPC,
  
  // Confirmed M2 masters
  DAC_M2: ALL_SORBONNE_MASTERS.DAC_M2,
  IMA_M2: ALL_SORBONNE_MASTERS.IMA_M2,
  ANDROIDE_M2: ALL_SORBONNE_MASTERS.ANDROIDE_M2,
  BIM_M2: ALL_SORBONNE_MASTERS.BIM_M2,
  RES_M2: ALL_SORBONNE_MASTERS.RES_M2,
  SAR_M2: ALL_SORBONNE_MASTERS.SAR_M2,
  SESI_M2: ALL_SORBONNE_MASTERS.SESI_M2,
  STL_M2: ALL_SORBONNE_MASTERS.STL_M2,
  HPC_M2: ALL_SORBONNE_MASTERS.HPC_M2
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

// Function to discover available courses for a master
export async function discoverCourses(master: SorborneCalendarSource): Promise<string[]> {
  try {
    console.log(`🔍 Discovering courses for ${master.id}...`);
    
    // Extract URL without embedded auth for fetch
    const urlWithoutAuth = master.url.replace('student.master:guest@', '');
    
    const response = await fetch(urlWithoutAuth, {
      method: 'GET',
      headers: {
        'Authorization': 'Basic ' + btoa('student.master:guest'),
        'User-Agent': 'ClearMyDay/1.0 (Course Discovery)',
        'Accept': 'text/calendar, application/calendar+xml'
      }
    });

    if (!response.ok) {
      console.log(`❌ ${master.id}: HTTP ${response.status}`);
      return [];
    }

    const icsContent = await response.text();
    
    // Extract course codes from event summaries using regex patterns
    const coursePatterns = [
      /([A-Z]{2,6}\d{0,3})/g,           // Standard course codes: MLBDA, MAPSI, etc.
      /([A-Z]{3,}(?:-[A-Z0-9]+)?)/g,   // Extended codes: DALAS, LRC, etc.
      /MU\d+[A-Z]+\d*-([A-Z]+)/g,      // Moodle format: MU4IN601-MAPSI
    ];

    const courses = new Set<string>();
    
    // Extract all SUMMARY lines
    const summaryLines = icsContent.match(/SUMMARY:([^\r\n]+)/g) || [];
    
    summaryLines.forEach(line => {
      const summary = line.replace('SUMMARY:', '').trim();
      
      // Apply all patterns to extract course codes
      coursePatterns.forEach(pattern => {
        const matches = summary.match(pattern);
        if (matches) {
          matches.forEach(match => {
            // Clean up the match
            const cleaned = match
              .replace(/^MU\d+[A-Z]+\d*-/, '') // Remove Moodle prefix
              .replace(/[^A-Z0-9]/g, '')       // Remove special chars
              .toUpperCase();
            
            // Filter valid course codes (3-6 chars, contains letters)
            if (cleaned.length >= 3 && cleaned.length <= 6 && /[A-Z]/.test(cleaned)) {
              courses.add(cleaned);
            }
          });
        }
      });
    });

    // Filter out common non-course words
    const excludeWords = ['COURS', 'EXAM', 'EXAMEN', 'SESSION', 'SALLE', 'AMPHI', 'TD', 'TME', 'TP'];
    const filteredCourses = Array.from(courses).filter(course => 
      !excludeWords.includes(course) && course.length >= 3
    );

    console.log(`✅ ${master.id}: Found ${filteredCourses.length} courses: ${filteredCourses.join(', ')}`);
    return filteredCourses.sort();

  } catch (error) {
    console.error(`❌ Failed to discover courses for ${master.id}:`, error);
    return [];
  }
}

// Function to discover courses for all accessible masters
export async function discoverAllCourses(): Promise<{ [masterId: string]: string[] }> {
  const results: { [masterId: string]: string[] } = {};
  
  // Test which masters are accessible first
  const accessibleMasters: SorborneCalendarSource[] = [];
  
  for (const [masterId, master] of Object.entries(ALL_SORBONNE_MASTERS)) {
    const isAccessible = await testCalDAVEndpoint(master);
    if (isAccessible) {
      accessibleMasters.push(master);
    }
  }

  console.log(`📚 Discovering courses for ${accessibleMasters.length} accessible masters...`);

  // Discover courses for each accessible master
  for (const master of accessibleMasters) {
    results[master.id] = await discoverCourses(master);
    
    // Add a small delay to be respectful to the server
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return results;
}
