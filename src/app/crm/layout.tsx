import React from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { CrmFrame } from '@/components/layout/crm-frame';
import type { Role } from '@/lib/types';
import { getRequestTabId } from '@/lib/auth/tab-server';
import { TabSessionRevive } from '@/components/auth/tab-session-revive';

export const dynamic = 'force-dynamic'

export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  if (!(await getRequestTabId())) return <TabSessionRevive />;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, is_active, department_id')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile) {
    redirect('/login');
  }

  if (!profile.is_active) {
    await supabase.auth.signOut();
    redirect('/login');
  }

  if (profile.role === 'client_admin' || profile.role === 'client_user') {
    redirect('/portal/catalogue');
  }

  const displayName = profile.full_name || user.email?.split('@')[0] || 'User';

  const { data: notifications } = await supabase
    .from('notifications')
    .select('id, title, body, link, read_at, created_at')
    .eq('audience', 'internal')
    .order('created_at', { ascending: false })
    .limit(20);

  return (
    <CrmFrame
      role={profile.role as Role}
      user={{ name: displayName, email: user.email || '' }}
      notifications={notifications || []}
    >
      {children}
    </CrmFrame>
  );
}
