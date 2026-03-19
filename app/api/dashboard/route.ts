import { NextResponse } from 'next/server';
import { buildDashboardData } from '@/lib/dashboard';

export const revalidate = 3600;

export async function GET() {
  try {
    const data = await buildDashboardData();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
}
