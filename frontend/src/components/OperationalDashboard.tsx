import { useState, useEffect } from 'react'
import { Card, Row, Col, Statistic, Tag, Space, Typography, theme, Spin, Alert } from 'antd'
import {
  useGetHealthMetricsQuery,
  useGetWorkflowMetricsQuery,
  useGetCommitsMetricsQuery,
  useGetCacheMetricsQuery,
} from '../store/ubosApi'
import {
  Activity,
  Database,
  GitCommit,
  HardDrive,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  TrendingUp,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

const { Text, Title } = Typography

interface OperationalDashboardProps {
  currentBranch?: string
}

// Color scheme for charts
const CHART_COLORS = ['#4A9EFF', '#52C41A', '#FAAD14', '#F5222D', '#722ED1', '#13C2C2']

export function OperationalDashboard({}: OperationalDashboardProps) {
  const {
    token: { colorBgContainer, colorText, colorTextSecondary, colorBorder, colorPrimary, colorSuccess, colorError, colorWarning },
  } = theme.useToken()

  // RTK Query hooks with polling (15 seconds)
  const pollingInterval = 15000 // 15 seconds

  const {
    data: healthData,
    isLoading: isLoadingHealth,
    error: healthError,
  } = useGetHealthMetricsQuery(undefined, {
    pollingInterval,
  })

  const {
    data: workflowData,
    isLoading: isLoadingWorkflow,
    error: workflowError,
  } = useGetWorkflowMetricsQuery(undefined, {
    pollingInterval,
  })

  const {
    data: commitsData,
    isLoading: isLoadingCommits,
    error: commitsError,
  } = useGetCommitsMetricsQuery(undefined, {
    pollingInterval,
  })

  const {
    data: cacheData,
    isLoading: isLoadingCache,
    error: cacheError,
  } = useGetCacheMetricsQuery(undefined, {
    pollingInterval,
  })

  // Get status color and icon
  const getStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'GREEN':
      case 'UP':
        return colorSuccess
      case 'YELLOW':
        return colorWarning
      case 'RED':
      case 'DOWN':
        return colorError
      default:
        return colorTextSecondary
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'GREEN':
      case 'UP':
        return <CheckCircle2 size={16} color={colorSuccess} />
      case 'YELLOW':
        return <AlertCircle size={16} color={colorWarning} />
      case 'RED':
      case 'DOWN':
        return <XCircle size={16} color={colorError} />
      default:
        return null
    }
  }

  // Prepare chart data
  const commitsByTypeData = commitsData?.commitsByEntityType
    ? Object.entries(commitsData.commitsByEntityType).map(([name, value]) => ({
        name,
        value,
      }))
    : []

  const commitsOverTimeData = commitsData?.commitsOverTime || []

  return (
    <div
      style={{
        padding: '24px',
        background: colorBgContainer,
        minHeight: '100%',
        overflow: 'auto',
      }}
    >
      <div style={{ marginBottom: '24px' }}>
        <Space>
          <Activity size={24} color={colorPrimary} />
          <Title level={2} style={{ margin: 0, color: colorText }}>
            Operational Dashboard
          </Title>
        </Space>
        <Text style={{ color: colorTextSecondary, fontSize: '13px', display: 'block', marginTop: '8px' }}>
          Real-time monitoring of UBOS Kernel health and performance (Auto-refresh: 15s)
        </Text>
      </div>

      <Row gutter={[16, 16]}>
        {/* System Status Card */}
        <Col xs={24} sm={24} md={12} lg={8} xl={6}>
          <Card
            title={
              <Space>
                <Activity size={16} />
                <span>System Status</span>
              </Space>
            }
            style={{
              border: `1px solid ${colorBorder}`,
              height: '100%',
            }}
            loading={isLoadingHealth}
          >
            {healthError ? (
              <Alert message="Failed to load health metrics" type="error" showIcon />
            ) : (
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                <div>
                  <Space>
                    {getStatusIcon(healthData?.status || 'UNKNOWN')}
                    <Tag
                      color={
                        healthData?.status === 'GREEN'
                          ? 'success'
                          : healthData?.status === 'RED'
                          ? 'error'
                          : 'warning'
                      }
                      style={{ fontSize: '13px', fontWeight: 500 }}
                    >
                      {healthData?.status || 'UNKNOWN'}
                    </Tag>
                  </Space>
                </div>
                {healthData?.databaseStatus && (
                  <div>
                    <Text style={{ color: colorTextSecondary, fontSize: '12px' }}>Database: </Text>
                    <Tag
                      color={healthData.databaseStatus === 'UP' ? 'success' : 'error'}
                      style={{ fontSize: '12px' }}
                    >
                      {healthData.databaseStatus}
                    </Tag>
                  </div>
                )}
                {healthData?.totalEntities !== undefined && (
                  <Statistic
                    title="Total Entities"
                    value={healthData.totalEntities}
                    prefix={<Database size={14} />}
                    valueStyle={{ fontSize: '20px', color: colorText }}
                  />
                )}
                {healthData?.lastSuccessfulCommitTime && (
                  <div>
                    <Space>
                      <Clock size={14} color={colorTextSecondary} />
                      <Text style={{ color: colorTextSecondary, fontSize: '12px' }}>
                        Last Commit:{' '}
                        {new Date(healthData.lastSuccessfulCommitTime).toLocaleString()}
                      </Text>
                    </Space>
                  </div>
                )}
              </Space>
            )}
          </Card>
        </Col>

        {/* Workflow Health Card */}
        <Col xs={24} sm={24} md={12} lg={8} xl={6}>
          <Card
            title={
              <Space>
                <GitCommit size={16} />
                <span>Workflow Health</span>
              </Space>
            }
            style={{
              border: `1px solid ${colorBorder}`,
              height: '100%',
            }}
            loading={isLoadingWorkflow}
          >
            {workflowError ? (
              <Alert message="Failed to load workflow metrics" type="error" showIcon />
            ) : (
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                <Statistic
                  title="Pending Approvals"
                  value={workflowData?.pendingApprovals || 0}
                  prefix={<AlertCircle size={14} color={colorError} />}
                  valueStyle={{
                    fontSize: '24px',
                    color: (workflowData?.pendingApprovals || 0) > 0 ? colorError : colorText,
                    fontWeight: 600,
                  }}
                />
                <Statistic
                  title="Pending Webhooks"
                  value={workflowData?.pendingWebhooks || 0}
                  prefix={<Clock size={14} />}
                  valueStyle={{ fontSize: '20px', color: colorText }}
                />
                {workflowData?.activeWorkflows !== undefined && (
                  <Statistic
                    title="Active Workflows"
                    value={workflowData.activeWorkflows}
                    valueStyle={{ fontSize: '18px', color: colorText }}
                  />
                )}
                {workflowData?.failedWorkflows !== undefined && (
                  <Statistic
                    title="Failed Workflows (24h)"
                    value={workflowData.failedWorkflows}
                    valueStyle={{
                      fontSize: '18px',
                      color: workflowData.failedWorkflows > 0 ? colorError : colorText,
                    }}
                  />
                )}
              </Space>
            )}
          </Card>
        </Col>

        {/* Cache Performance Card */}
        <Col xs={24} sm={24} md={12} lg={8} xl={6}>
          <Card
            title={
              <Space>
                <HardDrive size={16} />
                <span>Cache Performance</span>
              </Space>
            }
            style={{
              border: `1px solid ${colorBorder}`,
              height: '100%',
            }}
            loading={isLoadingCache}
          >
            {cacheError ? (
              <Alert message="Failed to load cache metrics" type="error" showIcon />
            ) : (
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                <Statistic
                  title="Hit Ratio"
                  value={cacheData?.hitRatio || 0}
                  suffix="%"
                  prefix={<TrendingUp size={14} />}
                  valueStyle={{
                    fontSize: '24px',
                    color:
                      (cacheData?.hitRatio || 0) >= 80
                        ? colorSuccess
                        : (cacheData?.hitRatio || 0) >= 50
                        ? colorWarning
                        : colorError,
                    fontWeight: 600,
                  }}
                />
                <Statistic
                  title="Total Cached Items"
                  value={cacheData?.totalCachedItems || 0}
                  prefix={<Database size={14} />}
                  valueStyle={{ fontSize: '20px', color: colorText }}
                />
                {cacheData?.cacheSize !== undefined && (
                  <Statistic
                    title="Cache Size"
                    value={(cacheData.cacheSize / 1024 / 1024).toFixed(2)}
                    suffix="MB"
                    valueStyle={{ fontSize: '18px', color: colorText }}
                  />
                )}
                {cacheData?.evictionCount !== undefined && (
                  <Statistic
                    title="Evictions (24h)"
                    value={cacheData.evictionCount}
                    valueStyle={{ fontSize: '18px', color: colorText }}
                  />
                )}
              </Space>
            )}
          </Card>
        </Col>

        {/* Performance Card - Commits */}
        <Col xs={24} sm={24} md={24} lg={24} xl={6}>
          <Card
            title={
              <Space>
                <GitCommit size={16} />
                <span>Commit Performance</span>
              </Space>
            }
            style={{
              border: `1px solid ${colorBorder}`,
              height: '100%',
            }}
            loading={isLoadingCommits}
          >
            {commitsError ? (
              <Alert message="Failed to load commit metrics" type="error" showIcon />
            ) : (
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                {commitsData?.totalCommits !== undefined && (
                  <Statistic
                    title="Total Commits (24h)"
                    value={commitsData.totalCommits}
                    valueStyle={{ fontSize: '20px', color: colorText }}
                  />
                )}
                {commitsData?.averageCommitTime !== undefined && (
                  <Statistic
                    title="Avg Commit Time"
                    value={commitsData.averageCommitTime}
                    suffix="ms"
                    valueStyle={{ fontSize: '18px', color: colorText }}
                  />
                )}
              </Space>
            )}
          </Card>
        </Col>
      </Row>

      {/* Charts Row */}
      <Row gutter={[16, 16]} style={{ marginTop: '16px' }}>
        {/* Commits by Entity Type - Pie Chart */}
        {commitsByTypeData.length > 0 && (
          <Col xs={24} sm={24} md={12} lg={12}>
            <Card
              title="Commits by Entity Type (24h)"
              style={{
                border: `1px solid ${colorBorder}`,
                height: '100%',
              }}
            >
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={commitsByTypeData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {commitsByTypeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </Card>
          </Col>
        )}

        {/* Commits Over Time - Bar Chart */}
        {commitsOverTimeData.length > 0 && (
          <Col xs={24} sm={24} md={12} lg={12}>
            <Card
              title="Commits Over Time (24h)"
              style={{
                border: `1px solid ${colorBorder}`,
                height: '100%',
              }}
            >
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={commitsOverTimeData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="count" fill={colorPrimary} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </Col>
        )}
      </Row>
    </div>
  )
}

