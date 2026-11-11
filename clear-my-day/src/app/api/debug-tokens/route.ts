// Debug endpoint to visualize stored calendar tokens
import { NextResponse } from 'next/server';
import { CalendarStorage } from '@/lib/calendar-storage';

export async function GET() {
  try {
    const tokens = await CalendarStorage.list();

    return NextResponse.json({
      success: true,
      totalTokens: tokens.length,
      tokens: tokens.map(token => ({
        token: token.token,
        name: token.name,
        createdAt: token.created_at,
        lastAccessed: token.last_accessed,
        accessCount: token.access_count,
        masters: token.filter.masters,
        courses: token.filter.courses,
        courseGroups: token.filter.courseGroups,
        subscriptionUrl: `/api/calendar/${token.token}`
      })),
      storageType: 'Supabase (persistent)',
      info: 'Tokens are stored persistently in Supabase and survive server restarts'
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Cleanup endpoint (optional)
export async function DELETE() {
  try {
    const deletedCount = await CalendarStorage.cleanup(30); // Clean tokens older than 30 days
    
    return NextResponse.json({
      success: true,
      message: `Cleaned up ${deletedCount} old tokens`,
      deletedCount
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
