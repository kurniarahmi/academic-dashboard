'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Sidebar() {
  const pathname = usePathname();

  // Daftar menu navigasi
  const navItems = [
    { name: 'Overview', href: '/', icon: 'dashboard' },
    { name: 'Academic Performance', href: '/academic', icon: 'school' },
    { name: 'Learning Habits', href: '/habits', icon: 'schedule' },
    { name: 'Student Segmentation', href: '/segmentation', icon: 'groups' },
  ];

  return (
    <aside className="flex flex-col justify-between h-screen w-64 p-4 shrink-0 border-r border-gray-200 z-50 bg-white fixed left-0 top-0">
      <div className="flex flex-col gap-6">
        
        {/* Header Brand */}
        <div className="flex items-center gap-2 px-1 pt-1">
          <div className="w-10 h-10 rounded-lg bg-black text-white flex items-center justify-center shadow-md">
            <span className="material-symbols-outlined text-xl">school</span>
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-gray-900 leading-tight">Looker Academic Analytics</span>
            <span className="text-xs text-gray-500">Institutional Research Office</span>
          </div>
        </div>

        {/* Menu Navigasi Dinamis */}
        <nav className="flex flex-col gap-2 mt-4">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            
            return (
              <Link 
                key={item.name} 
                href={item.href} 
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 ease-out active:scale-95 ${
                  isActive 
                    ? 'bg-black text-white shadow-md translate-x-1' // Gaya saat halaman aktif
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 hover:translate-x-1' // Gaya saat tidak aktif
                }`}
              >
                <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                <span className="text-sm font-medium">{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}