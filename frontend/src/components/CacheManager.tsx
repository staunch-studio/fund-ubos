import { useState } from 'react'
import { Card, Button, Space, Typography, Statistic, message, Spin, Alert } from 'antd'
import { Trash2, Database, RefreshCw } from 'lucide-react'
import { useGetCacheStatsQuery, useEvictAllCacheMutation } from '../store/ubosApi'
import { theme } from 'antd'

const { Title, Text } = Typography

interface CacheManagerProps {
  currentBranch?: string
}

export function CacheManager({}: CacheManagerProps) {
  const {
    token: { colorBgContainer, colorText, colorTextSecondary, colorBorder, colorPrimary },
  } = theme.useToken()

  const [evicting, setEvicting] = useState(false)

  // Fetch cache stats (optional - only if backend provides the endpoint)
  const {
    data: cacheStats,
    isLoading: isLoadingStats,
    refetch: refetchStats,
  } = useGetCacheStatsQuery(undefined, {
    // Skip if backend doesn't support stats endpoint
    skip: false, // Set to true if backend doesn't have GET /admin/cache/stats
  })

  const [evictAllCache, { isLoading: isEvicting }] = useEvictAllCacheMutation()

  const handleEvictAll = async () => {
    try {
      setEvicting(true)
      const result = await evictAllCache().unwrap()
      message.success({
        content: result.message || 'All snapshot cache cleared successfully',
        duration: 3,
      })
      // Refetch stats if available
      if (cacheStats !== undefined) {
        refetchStats()
      }
    } catch (err: any) {
      const errorMessage = err?.data?.message || err?.message || 'Failed to clear cache'
      message.error(errorMessage)
    } finally {
      setEvicting(false)
    }
  }

  return (
    <div
      style={{
        padding: '24px',
        background: colorBgContainer,
        minHeight: '100%',
        overflow: 'auto',
      }}
    >
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <Title level={2} style={{ marginBottom: '24px', color: colorText }}>
          <Database size={24} style={{ marginRight: '12px', verticalAlign: 'middle' }} />
          Cache Management
        </Title>

        <Alert
          message="Cache Management"
          description="Clear cached snapshot data to force fresh data retrieval from the backend. This will invalidate all cached queries and trigger refetch on next access."
          type="info"
          showIcon
          style={{ marginBottom: '24px' }}
        />

        {/* Cache Statistics (if available) */}
        {!isLoadingStats && cacheStats && (
          <Card
            style={{
              marginBottom: '24px',
              border: `1px solid ${colorBorder}`,
            }}
          >
            <Title level={4} style={{ color: colorText, marginBottom: '16px' }}>
              Cache Statistics
            </Title>
            <Space size="large">
              <Statistic
                title="Snapshot Cache Size"
                value={cacheStats.snapshotCacheSize || 0}
                prefix={<Database size={16} />}
                valueStyle={{ color: colorPrimary }}
              />
              {cacheStats.totalCacheSize !== undefined && (
                <Statistic
                  title="Total Cache Size"
                  value={cacheStats.totalCacheSize}
                  valueStyle={{ color: colorText }}
                />
              )}
            </Space>
          </Card>
        )}

        {isLoadingStats && (
          <Card
            style={{
              marginBottom: '24px',
              border: `1px solid ${colorBorder}`,
              textAlign: 'center',
              padding: '40px',
            }}
          >
            <Spin size="large" />
            <div style={{ marginTop: '16px', color: colorTextSecondary }}>
              Loading cache statistics...
            </div>
          </Card>
        )}

        {/* Clear Cache Action */}
        <Card
          style={{
            border: `1px solid ${colorBorder}`,
          }}
        >
          <Title level={4} style={{ color: colorText, marginBottom: '16px' }}>
            Actions
          </Title>
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <div>
              <Text style={{ color: colorTextSecondary, display: 'block', marginBottom: '8px' }}>
                Clear all snapshot cache entries. This will force all queries to refetch data from
                the backend on next access.
              </Text>
              <Button
                type="primary"
                danger
                icon={<Trash2 size={16} />}
                onClick={handleEvictAll}
                loading={isEvicting || evicting}
                size="large"
                style={{
                  minWidth: '200px',
                }}
              >
                {isEvicting || evicting ? 'Clearing Cache...' : 'Clear All Snapshot Cache'}
              </Button>
            </div>

            {cacheStats !== undefined && (
              <Button
                icon={<RefreshCw size={16} />}
                onClick={() => refetchStats()}
                loading={isLoadingStats}
                disabled={isEvicting || evicting}
              >
                Refresh Statistics
              </Button>
            )}
          </Space>
        </Card>

        {/* Information */}
        <Card
          style={{
            marginTop: '24px',
            border: `1px solid ${colorBorder}`,
            background: 'rgba(74, 158, 255, 0.05)',
          }}
        >
          <Title level={5} style={{ color: colorText, marginBottom: '12px' }}>
            About Cache Management
          </Title>
          <Space direction="vertical" size="small">
            <Text style={{ color: colorTextSecondary, fontSize: '13px' }}>
              • Cache clearing affects all cached snapshot data across all branches and entity
              types.
            </Text>
            <Text style={{ color: colorTextSecondary, fontSize: '13px' }}>
              • After clearing, data will be automatically refetched when you access entities.
            </Text>
            <Text style={{ color: colorTextSecondary, fontSize: '13px' }}>
              • This operation is safe and will not affect your data or commits.
            </Text>
          </Space>
        </Card>
      </div>
    </div>
  )
}

