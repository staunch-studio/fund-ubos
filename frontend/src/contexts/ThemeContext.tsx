import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { ConfigProvider, theme as antdTheme } from 'antd'
import type { ThemeConfig } from 'antd'

export type ThemeMode = 'dark' | 'light' | 'blue' | 'green'

interface ThemeContextType {
  themeMode: ThemeMode
  setThemeMode: (mode: ThemeMode) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context
}

// Theme configurations
const themes: Record<ThemeMode, ThemeConfig> = {
  dark: {
    algorithm: antdTheme.darkAlgorithm,
    token: {
      // Primary colors - Modern blue
      colorPrimary: '#4A9EFF',
      colorPrimaryHover: '#6BB0FF',
      colorPrimaryActive: '#3A8EFF',
      
      // Background colors - Rich dark theme
      colorBgContainer: '#0D1117',
      colorBgElevated: '#161B22',
      colorBgLayout: '#010409',
      colorBgSpotlight: '#1C2128',
      
      // Border colors
      colorBorder: '#30363D',
      colorBorderSecondary: '#21262D',
      
      // Text colors
      colorText: '#E6EDF3',
      colorTextSecondary: '#8B949E',
      colorTextTertiary: '#6E7681',
      colorTextQuaternary: '#484F58',
      
      // Success, Warning, Error
      colorSuccess: '#3FB950',
      colorWarning: '#D29922',
      colorError: '#F85149',
      colorInfo: '#58A6FF',
      
      borderRadius: 6,
      borderRadiusLG: 8,
      borderRadiusSM: 4,
      
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif',
      fontSize: 14,
      fontSizeLG: 16,
      fontSizeSM: 12,
      
      padding: 16,
      paddingLG: 24,
      paddingSM: 12,
      paddingXS: 8,
    },
    components: {
      Layout: {
        bodyBg: '#010409',
        headerBg: '#161B22',
        headerHeight: 56,
        headerPadding: '0 24px',
        siderBg: '#161B22',
      },
      Menu: {
        itemBg: 'transparent',
        itemHoverBg: '#21262D',
        itemSelectedBg: '#1F6FEB',
        itemSelectedColor: '#FFFFFF',
        itemActiveBg: '#1F6FEB',
        itemMarginInline: 0,
        itemBorderRadius: 6,
      },
      Table: {
        headerBg: '#161B22',
        headerColor: '#E6EDF3',
        rowHoverBg: '#161B22',
        borderColor: '#30363D',
        cellPaddingBlock: 12,
        cellPaddingInline: 16,
      },
      Input: {
        colorBgContainer: '#0D1117',
        colorBorder: '#30363D',
        hoverBorderColor: '#1F6FEB',
        activeBorderColor: '#1F6FEB',
      },
      Button: {
        primaryShadow: '0 0 0 2px rgba(74, 158, 255, 0.2)',
      },
      Select: {
        optionSelectedBg: '#1F6FEB',
        optionActiveBg: '#21262D',
      },
    },
  },
  
  light: {
    algorithm: antdTheme.defaultAlgorithm,
    token: {
      // Primary colors - Vibrant blue
      colorPrimary: '#1890ff',
      colorPrimaryHover: '#40a9ff',
      colorPrimaryActive: '#096dd9',
      
      // Background colors - Clean light theme
      colorBgContainer: '#FFFFFF',
      colorBgElevated: '#FAFAFA',
      colorBgLayout: '#F5F5F5',
      colorBgSpotlight: '#FFFFFF',
      
      // Border colors
      colorBorder: '#D9D9D9',
      colorBorderSecondary: '#E8E8E8',
      
      // Text colors
      colorText: '#262626',
      colorTextSecondary: '#8C8C8C',
      colorTextTertiary: '#BFBFBF',
      colorTextQuaternary: '#D9D9D9',
      
      // Success, Warning, Error
      colorSuccess: '#52c41a',
      colorWarning: '#faad14',
      colorError: '#ff4d4f',
      colorInfo: '#1890ff',
      
      borderRadius: 6,
      borderRadiusLG: 8,
      borderRadiusSM: 4,
      
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif',
      fontSize: 14,
      fontSizeLG: 16,
      fontSizeSM: 12,
      
      padding: 16,
      paddingLG: 24,
      paddingSM: 12,
      paddingXS: 8,
    },
    components: {
      Layout: {
        bodyBg: '#F5F5F5',
        headerBg: '#FFFFFF',
        headerHeight: 56,
        headerPadding: '0 24px',
        siderBg: '#FAFAFA',
      },
      Menu: {
        itemBg: 'transparent',
        itemHoverBg: '#F5F5F5',
        itemSelectedBg: '#E6F7FF',
        itemSelectedColor: '#1890ff',
        itemActiveBg: '#E6F7FF',
        itemMarginInline: 0,
        itemBorderRadius: 6,
      },
      Table: {
        headerBg: '#FAFAFA',
        headerColor: '#262626',
        rowHoverBg: '#F5F5F5',
        borderColor: '#E8E8E8',
        cellPaddingBlock: 12,
        cellPaddingInline: 16,
      },
      Input: {
        colorBgContainer: '#FFFFFF',
        colorBorder: '#D9D9D9',
        hoverBorderColor: '#40a9ff',
        activeBorderColor: '#1890ff',
      },
      Button: {
        primaryShadow: '0 0 0 2px rgba(24, 144, 255, 0.2)',
      },
      Select: {
        optionSelectedBg: '#E6F7FF',
        optionActiveBg: '#F5F5F5',
      },
    },
  },
  
  blue: {
    algorithm: antdTheme.darkAlgorithm,
    token: {
      // Primary colors - Ocean blue
      colorPrimary: '#00B4D8',
      colorPrimaryHover: '#0096C7',
      colorPrimaryActive: '#0077B6',
      
      // Background colors - Blue-tinted dark theme
      colorBgContainer: '#0A1929',
      colorBgElevated: '#132F4C',
      colorBgLayout: '#05141F',
      colorBgSpotlight: '#1A3A5C',
      
      // Border colors
      colorBorder: '#1E4976',
      colorBorderSecondary: '#2E5984',
      
      // Text colors
      colorText: '#E0F2FE',
      colorTextSecondary: '#7DD3FC',
      colorTextTertiary: '#38BDF8',
      colorTextQuaternary: '#0EA5E9',
      
      // Success, Warning, Error
      colorSuccess: '#10B981',
      colorWarning: '#F59E0B',
      colorError: '#EF4444',
      colorInfo: '#00B4D8',
      
      borderRadius: 6,
      borderRadiusLG: 8,
      borderRadiusSM: 4,
      
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif',
      fontSize: 14,
      fontSizeLG: 16,
      fontSizeSM: 12,
      
      padding: 16,
      paddingLG: 24,
      paddingSM: 12,
      paddingXS: 8,
    },
    components: {
      Layout: {
        bodyBg: '#05141F',
        headerBg: '#132F4C',
        headerHeight: 56,
        headerPadding: '0 24px',
        siderBg: '#0A1929',
      },
      Menu: {
        itemBg: 'transparent',
        itemHoverBg: '#1A3A5C',
        itemSelectedBg: '#0077B6',
        itemSelectedColor: '#FFFFFF',
        itemActiveBg: '#0077B6',
        itemMarginInline: 0,
        itemBorderRadius: 6,
      },
      Table: {
        headerBg: '#132F4C',
        headerColor: '#E0F2FE',
        rowHoverBg: '#1A3A5C',
        borderColor: '#1E4976',
        cellPaddingBlock: 12,
        cellPaddingInline: 16,
      },
      Input: {
        colorBgContainer: '#0A1929',
        colorBorder: '#1E4976',
        hoverBorderColor: '#00B4D8',
        activeBorderColor: '#00B4D8',
      },
      Button: {
        primaryShadow: '0 0 0 2px rgba(0, 180, 216, 0.3)',
      },
      Select: {
        optionSelectedBg: '#0077B6',
        optionActiveBg: '#1A3A5C',
      },
    },
  },
  
  green: {
    algorithm: antdTheme.darkAlgorithm,
    token: {
      // Primary colors - Emerald green
      colorPrimary: '#10B981',
      colorPrimaryHover: '#059669',
      colorPrimaryActive: '#047857',
      
      // Background colors - Green-tinted dark theme
      colorBgContainer: '#0F1B14',
      colorBgElevated: '#1A2E21',
      colorBgLayout: '#0A1410',
      colorBgSpotlight: '#1F3A2A',
      
      // Border colors
      colorBorder: '#2D4A3A',
      colorBorderSecondary: '#3D5A4A',
      
      // Text colors
      colorText: '#D1FAE5',
      colorTextSecondary: '#6EE7B7',
      colorTextTertiary: '#34D399',
      colorTextQuaternary: '#10B981',
      
      // Success, Warning, Error
      colorSuccess: '#10B981',
      colorWarning: '#F59E0B',
      colorError: '#EF4444',
      colorInfo: '#3B82F6',
      
      borderRadius: 6,
      borderRadiusLG: 8,
      borderRadiusSM: 4,
      
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif',
      fontSize: 14,
      fontSizeLG: 16,
      fontSizeSM: 12,
      
      padding: 16,
      paddingLG: 24,
      paddingSM: 12,
      paddingXS: 8,
    },
    components: {
      Layout: {
        bodyBg: '#0A1410',
        headerBg: '#1A2E21',
        headerHeight: 56,
        headerPadding: '0 24px',
        siderBg: '#0F1B14',
      },
      Menu: {
        itemBg: 'transparent',
        itemHoverBg: '#1F3A2A',
        itemSelectedBg: '#047857',
        itemSelectedColor: '#FFFFFF',
        itemActiveBg: '#047857',
        itemMarginInline: 0,
        itemBorderRadius: 6,
      },
      Table: {
        headerBg: '#1A2E21',
        headerColor: '#D1FAE5',
        rowHoverBg: '#1F3A2A',
        borderColor: '#2D4A3A',
        cellPaddingBlock: 12,
        cellPaddingInline: 16,
      },
      Input: {
        colorBgContainer: '#0F1B14',
        colorBorder: '#2D4A3A',
        hoverBorderColor: '#10B981',
        activeBorderColor: '#10B981',
      },
      Button: {
        primaryShadow: '0 0 0 2px rgba(16, 185, 129, 0.3)',
      },
      Select: {
        optionSelectedBg: '#047857',
        optionActiveBg: '#1F3A2A',
      },
    },
  },
}

interface ThemeProviderProps {
  children: ReactNode
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    // Load from localStorage or default to 'dark'
    const saved = localStorage.getItem('ubos-theme')
    return (saved as ThemeMode) || 'dark'
  })

  useEffect(() => {
    // Save to localStorage
    localStorage.setItem('ubos-theme', themeMode)
  }, [themeMode])

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode)
  }

  const currentTheme = themes[themeMode]

  return (
    <ThemeContext.Provider value={{ themeMode, setThemeMode }}>
      <ConfigProvider theme={currentTheme}>
        {children}
      </ConfigProvider>
    </ThemeContext.Provider>
  )
}




