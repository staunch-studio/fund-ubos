import { useTheme } from '../contexts/ThemeContext'
import { Select, Space, Typography } from 'antd'
import { Palette, Moon, Sun, Droplet, Leaf } from 'lucide-react'
import { theme } from 'antd'

const { Text } = Typography

export function ThemeSelector() {
  const { themeMode, setThemeMode } = useTheme()
  const {
    token: { colorText, colorTextSecondary, colorPrimary },
  } = theme.useToken()

  const themeOptions = [
    {
      value: 'dark' as const,
      label: (
        <Space>
          <Moon size={14} />
          <span>Dark</span>
        </Space>
      ),
      icon: <Moon size={14} />,
    },
    {
      value: 'light' as const,
      label: (
        <Space>
          <Sun size={14} />
          <span>Light</span>
        </Space>
      ),
      icon: <Sun size={14} />,
    },
    {
      value: 'blue' as const,
      label: (
        <Space>
          <Droplet size={14} />
          <span>Ocean Blue</span>
        </Space>
      ),
      icon: <Droplet size={14} />,
    },
    {
      value: 'green' as const,
      label: (
        <Space>
          <Leaf size={14} />
          <span>Emerald</span>
        </Space>
      ),
      icon: <Leaf size={14} />,
    },
  ]

  return (
    <Space size="middle">
      <Palette size={16} color={colorTextSecondary} />
      <Text style={{ color: colorTextSecondary, fontSize: '13px' }}>Theme:</Text>
      <Select
        value={themeMode}
        onChange={setThemeMode}
        style={{ width: 140 }}
        options={themeOptions}
        suffixIcon={null}
      />
    </Space>
  )
}



