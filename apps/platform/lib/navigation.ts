import { hasCapability } from "@/lib/rbac";
import { auth } from "@aic/auth";

export async function getNavigation() {
  const session = await auth();
  if (!session?.user?.id) return [];

  const nav = [];

  // Core Platform (Always visible if logged in)
  nav.push({ label: 'Dashboard', href: '/dashboard', icon: 'Layout' });

  // HQ Module
  if (await hasCapability(session.user.id, 'access_hq')) {
    nav.push({ 
      label: 'Institutional HQ', 
      href: '/hq', 
      icon: 'Building2',
      badge: 'Metrics'
    });
    nav.push({
      label: 'Empathy Engine',
      href: '/empathy',
      icon: 'Heart',
      badge: 'B0-2'
    });
  }

  // Admin Module
  if (await hasCapability(session.user.id, 'access_admin_tools')) {
    nav.push({ 
      label: 'System Admin', 
      href: '/admin', 
      icon: 'ShieldAlert',
      items: [
        { label: 'User Directory', href: '/admin/users' },
        { label: 'Organizations', href: '/admin/organizations' },
        { label: 'Permissions (God Mode)', href: '/admin/permissions' }
      ]
    });
  }

  // Internal Staff Tools
  if (await hasCapability(session.user.id, 'access_internal_tools')) {
    nav.push({ label: 'Internal Ops', href: '/internal', icon: 'Hammer' });
  }

  return nav;
}
