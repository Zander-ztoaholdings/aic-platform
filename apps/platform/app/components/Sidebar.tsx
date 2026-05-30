"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Layout, 
  Building2, 
  ShieldAlert, 
  Hammer, 
  Settings, 
  LogOut,
  Shield,
  Zap,
  Briefcase,
  Heart
} from "lucide-react";
import { cn } from "@/lib/utils";

const ICON_MAP: Record<string, any> = {
  Layout,
  Building2,
  ShieldAlert,
  Hammer,
  Settings,
  Shield,
  Zap,
  Briefcase,
  Heart,
};

interface SidebarProps {
  navItems: any[];
}

export function Sidebar({ navItems }: SidebarProps) {
  const pathname = usePathname();

  return (
    <div className="w-64 bg-aic-navy h-screen flex flex-col fixed left-0 top-0 text-aic-white z-50 shadow-2xl">
      <div className="p-6 border-b border-aic-paper/5">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-8 h-8 bg-aic-navy-mid/10 rounded flex items-center justify-center">
            <Shield className="w-5 h-5 text-aic-gold" />
          </div>
          <div className="font-bold text-lg tracking-tight">AIC Portal</div>
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-8">
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = ICON_MAP[item.icon] || Layout;
            const isActive = pathname === item.href;

            return (
              <div key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-xl transition-all group",
                    isActive
                      ? "bg-aic-gold text-aic-navy shadow-lg shadow-aic-gold/20"
                      : "text-aic-paper/60 hover:bg-aic-navy-mid/10 hover:text-aic-paper"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={cn("w-5 h-5", isActive ? "text-aic-navy" : "text-aic-gold/60 group-hover:text-aic-gold")} />
                    <span className="text-sm font-semibold">{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-aic-paper/10 text-aic-paper/60 group-hover:text-aic-paper/80 transition-colors">
                      {item.badge}
                    </span>
                  )}
                </Link>
                
                {item.items && (
                  <div className="ml-9 mt-2 space-y-1 border-l border-aic-paper/5 pl-4">
                    {item.items.map((sub: any) => (
                      <Link
                        key={sub.href}
                        href={sub.href}
                        className={cn(
                          "block text-xs py-2 transition-colors",
                          pathname === sub.href ? "text-aic-gold font-bold" : "text-aic-paper/40 hover:text-aic-paper"
                        )}
                      >
                        {sub.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>

      <div className="p-4 border-t border-aic-paper/5">
        <button className="w-full flex items-center gap-3 p-3 text-aic-paper/40 hover:text-red-400 hover:bg-red-500/5 rounded-xl transition-all text-sm font-medium">
          <LogOut className="w-5 h-5" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
}
