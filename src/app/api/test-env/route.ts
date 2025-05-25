import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || 'not set',
    hasSupabaseKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    hasSendGridKey: !!process.env.SENDGRID_API_KEY,
    hasTelnyxKey: !!process.env.TELNYX_API_KEY,
    hasStripeKey: !!process.env.STRIPE_SECRET_KEY,
    tempoEnabled: !!process.env.NEXT_PUBLIC_TEMPO,
  });
} 