import { NextResponse } from 'next/server'

export async function GET() {
  try {
    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'tax-filing-app'
    }, { status: 200 })
  } catch (error) {
    return NextResponse.json({
      status: 'unhealthy',
      error: 'Service unavailable'
    }, { status: 503 })
  }
}
