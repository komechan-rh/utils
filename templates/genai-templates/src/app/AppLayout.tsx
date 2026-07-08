import { NavLink, Outlet } from 'react-router-dom';

const navItems = [
  { to: '/', label: 'Home' },
  { to: '/about', label: 'About' },
];

export function AppLayout() {
  return (
    <div className="mx-auto w-[min(1120px,calc(100%-32px))] px-0 py-8 pb-12">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-black/8 bg-white/84 p-6 shadow-[0_18px_48px_rgba(17,28,45,0.08)] backdrop-blur-xl">
        <div>
          <p className="m-0 text-[0.8rem] font-bold tracking-[0.08em] text-brand-500 uppercase">
            React Practical Template
          </p>
          <h1 className="mt-2 text-[clamp(1.4rem,4vw,2rem)] font-semibold">
            保守しやすいフロントエンドの土台
          </h1>
        </div>
        <nav aria-label="Primary navigation" className="flex flex-wrap gap-3">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `rounded-full px-3.5 py-2.5 transition-all duration-150 ease-out ${
                  isActive
                    ? 'bg-ink-950 text-white'
                    : 'bg-transparent text-ink-700 hover:bg-white/70 hover:text-ink-950'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="pt-6">
        <Outlet />
      </main>
    </div>
  );
}
