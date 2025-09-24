// API endpoint to discover courses for all accessible masters

import { NextRequest, NextResponse } from 'next/server';
import { ALL_SORBONNE_MASTERS, discoverCourses, discoverAllCourses } from '@/lib/sorbonne-masters';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const masterId = searchParams.get('master');
    const updateFile = searchParams.get('update') === 'true';

    if (masterId) {
      // Discover courses for a specific master
      const master = ALL_SORBONNE_MASTERS[masterId];
      if (!master) {
        return NextResponse.json(
          { success: false, error: `Master '${masterId}' not found` },
          { status: 404 }
        );
      }

      const courses = await discoverCourses(master);
      
      return NextResponse.json({
        success: true,
        master: {
          id: master.id,
          name: master.name,
          courses: courses,
          courseCount: courses.length
        }
      });
    } else {
      // Discover courses for all accessible masters
      const allCourses = await discoverAllCourses();
      
      // Calculate statistics
      const totalMasters = Object.keys(allCourses).length;
      const totalCourses = Object.values(allCourses).reduce((sum, courses) => sum + courses.length, 0);
      const avgCoursesPerMaster = totalMasters > 0 ? Math.round(totalCourses / totalMasters) : 0;

      // Generate code to update the sorbonne-masters.ts file
      let updateCode = '';
      if (updateFile) {
        updateCode = generateMasterUpdateCode(allCourses);
      }

      return NextResponse.json({
        success: true,
        summary: {
          totalMasters,
          totalCourses,
          avgCoursesPerMaster,
          mastersWithCourses: Object.entries(allCourses).filter(([_, courses]) => courses.length > 0).length
        },
        coursesByMaster: allCourses,
        ...(updateFile && { updateCode })
      });
    }

  } catch (error) {
    console.error('Error discovering courses:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to discover courses' },
      { status: 500 }
    );
  }
}

// Generate TypeScript code to update the masters file
function generateMasterUpdateCode(coursesByMaster: { [masterId: string]: string[] }): string {
  const updates = Object.entries(coursesByMaster)
    .filter(([_, courses]) => courses.length > 0)
    .map(([masterId, courses]) => {
      const coursesArray = courses.map(c => `'${c}'`).join(', ');
      return `  ${masterId}: { ...ALL_SORBONNE_MASTERS.${masterId}, courses: [${coursesArray}] }`;
    });

  return `// Auto-generated course updates (copy to sorbonne-masters.ts)
export const MASTERS_WITH_DISCOVERED_COURSES = {
${updates.join(',\n')}
};

// Or update individual masters:
${Object.entries(coursesByMaster)
  .filter(([_, courses]) => courses.length > 0)
  .map(([masterId, courses]) => {
    const coursesArray = courses.map(c => `'${c}'`).join(', ');
    return `// ${masterId}: courses: [${coursesArray}]`;
  }).join('\n')}`;
}

// Usage examples:
// GET /api/discover-courses - Discover courses for all masters
// GET /api/discover-courses?master=DAC - Discover courses for specific master
// GET /api/discover-courses?update=true - Include TypeScript update code
