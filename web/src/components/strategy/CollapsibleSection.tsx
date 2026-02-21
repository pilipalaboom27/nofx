import { useState, type ReactNode } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

interface CollapsibleSectionProps {
  title: string
  icon?: ReactNode
  enforcementType?: 'code' | 'ai' | 'mixed'
  defaultOpen?: boolean
  children: ReactNode
  language?: string
}

export function CollapsibleSection({
  title,
  icon,
  enforcementType = 'code',
  defaultOpen = false,
  children,
  language = 'en',
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  const t = (key: string) => {
    const translations: Record<string, Record<string, string>> = {
      codeEnforced: { zh: '代码强制', en: 'CODE ENFORCED' },
      aiGuided: { zh: 'AI引导', en: 'AI GUIDED' },
      mixedMode: { zh: '混合', en: 'MIXED' },
    }
    return translations[key]?.[language] || key
  }

  const getEnforcementStyle = () => {
    switch (enforcementType) {
      case 'code':
        return {
          borderColor: '#0ECB81',
          badgeBg: 'rgba(14, 203, 129, 0.15)',
          badgeColor: '#0ECB81',
          badgeText: t('codeEnforced'),
        }
      case 'ai':
        return {
          borderColor: '#F0B90B',
          badgeBg: 'rgba(240, 185, 11, 0.15)',
          badgeColor: '#F0B90B',
          badgeText: t('aiGuided'),
        }
      case 'mixed':
        return {
          borderColor: '#a855f7',
          badgeBg: 'rgba(168, 85, 247, 0.15)',
          badgeColor: '#a855f7',
          badgeText: t('mixedMode'),
        }
      default:
        return {
          borderColor: '#2B3139',
          badgeBg: 'rgba(43, 49, 57, 0.15)',
          badgeColor: '#848E9C',
          badgeText: '',
        }
    }
  }

  const style = getEnforcementStyle()

  return (
    <div
      className="rounded-lg overflow-hidden mb-3"
      style={{ border: `1px solid ${style.borderColor}` }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between p-3 cursor-pointer select-none"
        style={{ background: '#0B0E11' }}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-medium" style={{ color: '#EAECEF' }}>
            {title}
          </span>
          <span
            className="text-xs px-2 py-0.5 rounded"
            style={{ background: style.badgeBg, color: style.badgeColor }}
          >
            {style.badgeText}
          </span>
        </div>
        <div style={{ color: '#848E9C' }}>
          {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </div>
      </div>

      {/* Content */}
      {isOpen && (
        <div className="p-4" style={{ background: '#0B0E11' }}>
          {children}
        </div>
      )}
    </div>
  )
}
