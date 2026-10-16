import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'

type Theme = 'light' | 'dark'

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('hb_interface_theme')
    return saved === 'light' || saved === 'dark' ? saved : matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  useEffect(() => {
    const system = matchMedia('(prefers-color-scheme: dark)')
    const update = () => {
      if (!localStorage.getItem('hb_interface_theme')) setTheme(system.matches ? 'dark' : 'light')
    }
    system.addEventListener('change', update)
    return () => system.removeEventListener('change', update)
  }, [])

  const label = theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'
  return <button type="button" className="theme-toggle" aria-label={label} title={label} onClick={() => {
    const next = theme === 'dark' ? 'light' : 'dark'
    localStorage.setItem('hb_interface_theme', next)
    setTheme(next)
  }}>{theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}</button>
}
