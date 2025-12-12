import { useState, useMemo, useEffect } from 'react'
import { Tabs, Table, Button, Space, Tag, message, theme, Typography, Modal, Input, Select } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { User, Users, Shield, Edit } from 'lucide-react'
import { useGetEntitiesQuery, useGetSnapshotQuery, useBatchCommitMutation } from '../store/ubosApi'
import type { EntityInstance } from '../types/ubos'
import {
  parseUserFromSnapshot,
  formatUserToSnapshotData,
  entityToUser,
  parseGroupFromSnapshot,
  formatGroupToSnapshotData,
  entityToGroup,
  parsePolicyFromSnapshot,
  formatPolicyToSnapshotData,
  entityToPolicy,
  type UserData,
  type GroupData,
  type PolicyData,
} from '../utils/entityHelpers'
import Editor from '@monaco-editor/react'

const { Text } = Typography
const { TextArea } = Input

interface IdentityManagerProps {
  currentBranch: string
}

type TabKey = 'users' | 'groups' | 'policies'

// Component to render a single user row with snapshot data
function UserRow({ entity, currentBranch, onEdit }: {
  entity: EntityInstance
  currentBranch: string
  onEdit: (entity: EntityInstance, userData: UserData) => void
}) {
  const uri = `ubos://USER/${entity.slug}?branch=${currentBranch}`
  const { data: snapshot, isLoading } = useGetSnapshotQuery(uri, {
    skip: !entity.slug,
  })

  const userData = snapshot && !isLoading ? parseUserFromSnapshot(snapshot) : null
  const partial = entityToUser(entity)

  const data: UserData = userData || {
    userId: entity.slug,
    slug: entity.slug,
    groups: [],
    isActive: true,
    createdAt: partial.createdAt || entity.createdAt,
  }

  const {
    token: { colorText, colorTextSecondary, colorBorder, colorPrimary, colorSuccess },
  } = theme.useToken()

  if (isLoading) {
    return (
      <tr>
        <td colSpan={5} style={{ textAlign: 'center', padding: '16px' }}>
          <Text style={{ color: colorTextSecondary }}>Loading...</Text>
        </td>
      </tr>
    )
  }

  return (
    <tr>
      <td>
        <Text style={{ fontWeight: 500, color: colorText }}>{entity.slug}</Text>
      </td>
      <td>
        <Text style={{ color: colorTextSecondary, fontSize: '12px' }}>{data.email || '-'}</Text>
      </td>
      <td>
        <Text style={{ color: colorTextSecondary, fontSize: '12px' }}>{data.displayName || '-'}</Text>
      </td>
      <td>
        <Space size="small" wrap>
          {data.groups && data.groups.length > 0 ? (
            data.groups.map((group) => (
              <Tag key={group} color="blue" style={{ margin: 0 }}>
                {group}
              </Tag>
            ))
          ) : (
            <Text style={{ color: colorTextSecondary, fontSize: '12px' }}>-</Text>
          )}
        </Space>
      </td>
      <td>
        <Tag color={data.isActive ? 'success' : 'default'} style={{ margin: 0 }}>
          {data.isActive ? 'Active' : 'Inactive'}
        </Tag>
      </td>
      <td>
        <Button
          type="link"
          size="small"
          icon={<Edit size={14} />}
          onClick={() => onEdit(entity, data)}
        >
          Edit Groups
        </Button>
      </td>
    </tr>
  )
}

// Component to render a single group row with snapshot data
function GroupRow({ entity, currentBranch, onEdit }: {
  entity: EntityInstance
  currentBranch: string
  onEdit: (entity: EntityInstance, groupData: GroupData) => void
}) {
  const uri = `ubos://GROUP/${entity.slug}?branch=${currentBranch}`
  const { data: snapshot, isLoading } = useGetSnapshotQuery(uri, {
    skip: !entity.slug,
  })

  const groupData = snapshot && !isLoading ? parseGroupFromSnapshot(snapshot) : null
  const partial = entityToGroup(entity)

  const data: GroupData = groupData || {
    groupId: entity.slug,
    groupName: entity.slug,
    roles: [],
    isActive: true,
    createdAt: partial.createdAt || entity.createdAt,
  }

  const {
    token: { colorText, colorTextSecondary },
  } = theme.useToken()

  if (isLoading) {
    return (
      <tr>
        <td colSpan={4} style={{ textAlign: 'center', padding: '16px' }}>
          <Text style={{ color: colorTextSecondary }}>Loading...</Text>
        </td>
      </tr>
    )
  }

  return (
    <tr>
      <td>
        <Text style={{ fontWeight: 500, color: colorText }}>{data.groupName}</Text>
      </td>
      <td>
        <Text style={{ color: colorTextSecondary, fontSize: '12px' }}>{data.description || '-'}</Text>
      </td>
      <td>
        <Space size="small" wrap>
          {data.roles && data.roles.length > 0 ? (
            data.roles.map((role) => (
              <Tag key={role} color="purple" style={{ margin: 0 }}>
                {role}
              </Tag>
            ))
          ) : (
            <Text style={{ color: colorTextSecondary, fontSize: '12px' }}>-</Text>
          )}
        </Space>
      </td>
      <td>
        <Tag color={data.isActive ? 'success' : 'default'} style={{ margin: 0 }}>
          {data.isActive ? 'Active' : 'Inactive'}
        </Tag>
      </td>
      <td>
        <Button
          type="link"
          size="small"
          icon={<Edit size={14} />}
          onClick={() => onEdit(entity, data)}
        >
          Edit Roles
        </Button>
      </td>
    </tr>
  )
}

export function IdentityManager({ currentBranch }: IdentityManagerProps) {
  const {
    token: { colorText, colorTextSecondary, colorBorder, colorPrimary, colorBgContainer },
  } = theme.useToken()

  const [activeTab, setActiveTab] = useState<TabKey>('users')
  const [userEditModalOpen, setUserEditModalOpen] = useState(false)
  const [groupEditModalOpen, setGroupEditModalOpen] = useState(false)
  const [policyEditModalOpen, setPolicyEditModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<{ entity: EntityInstance; data: UserData } | null>(null)
  const [editingGroup, setEditingGroup] = useState<{ entity: EntityInstance; data: GroupData } | null>(null)
  const [editingPolicy, setEditingPolicy] = useState<{ entity: EntityInstance; data: PolicyData } | null>(null)
  const [policyRulesJson, setPolicyRulesJson] = useState('{}')

  // Fetch entities
  const { data: users = [], isLoading: isLoadingUsers, refetch: refetchUsers } = useGetEntitiesQuery({
    branch: currentBranch,
    type: 'USER',
  })

  const { data: groups = [], isLoading: isLoadingGroups, refetch: refetchGroups } = useGetEntitiesQuery({
    branch: currentBranch,
    type: 'GROUP',
  })

  const { data: policies = [], isLoading: isLoadingPolicies, refetch: refetchPolicies } = useGetEntitiesQuery({
    branch: currentBranch,
    type: 'POLICY',
  })

  const [batchCommit, { isLoading: isCommitting }] = useBatchCommitMutation()

  // Fetch all groups for user edit modal
  const { data: allGroups = [] } = useGetEntitiesQuery({
    branch: currentBranch,
    type: 'GROUP',
  })

  // Fetch all policies for group edit modal
  const { data: allPolicies = [] } = useGetEntitiesQuery({
    branch: currentBranch,
    type: 'POLICY',
  })

  const handleUserEdit = (entity: EntityInstance, userData: UserData) => {
    setEditingUser({ entity, data: userData })
    setUserEditModalOpen(true)
  }

  const handleGroupEdit = (entity: EntityInstance, groupData: GroupData) => {
    setEditingGroup({ entity, data: groupData })
    setGroupEditModalOpen(true)
  }

  const handlePolicyEditClick = (entity: EntityInstance) => {
    // We'll fetch the snapshot when the modal opens
    setEditingPolicy({ entity, data: { policyId: entity.slug, policyName: entity.slug, rules: {}, isActive: true } })
    setPolicyRulesJson('{}')
    setPolicyEditModalOpen(true)
  }

  const handleUserSave = async (selectedGroups: string[]) => {
    if (!editingUser) return

    try {
      const updatedUser: UserData = {
        ...editingUser.data,
        groups: selectedGroups,
      }

      const jsonPatch = JSON.stringify([
        {
          op: 'replace',
          path: '/snapshotData',
          value: formatUserToSnapshotData(updatedUser),
        },
      ])

      await batchCommit({
        slugs: [editingUser.entity.slug],
        branch: currentBranch,
        jsonPatch,
        message: `Update user ${editingUser.data.slug} groups`,
      }).unwrap()

      message.success('User groups updated successfully')
      setUserEditModalOpen(false)
      setEditingUser(null)
      refetchUsers()
    } catch (err: any) {
      const errorMessage = err?.data?.message || err?.message || 'Failed to update user'
      if (err?.status === 403 || err?.data?.status === 403) {
        message.error(`Permission Denied: ${errorMessage}`)
      } else {
        message.error(errorMessage)
      }
    }
  }

  const handleGroupSave = async (selectedRoles: string[]) => {
    if (!editingGroup) return

    try {
      const updatedGroup: GroupData = {
        ...editingGroup.data,
        roles: selectedRoles,
      }

      const jsonPatch = JSON.stringify([
        {
          op: 'replace',
          path: '/snapshotData',
          value: formatGroupToSnapshotData(updatedGroup),
        },
      ])

      await batchCommit({
        slugs: [editingGroup.entity.slug],
        branch: currentBranch,
        jsonPatch,
        message: `Update group ${editingGroup.data.groupName} roles`,
      }).unwrap()

      message.success('Group roles updated successfully')
      setGroupEditModalOpen(false)
      setEditingGroup(null)
      refetchGroups()
    } catch (err: any) {
      const errorMessage = err?.data?.message || err?.message || 'Failed to update group'
      if (err?.status === 403 || err?.data?.status === 403) {
        message.error(`Permission Denied: ${errorMessage}`)
      } else {
        message.error(errorMessage)
      }
    }
  }

  const handlePolicySave = async (rulesJson: string) => {
    if (!editingPolicy) return

    try {
      let rules: Record<string, any>
      try {
        rules = JSON.parse(rulesJson)
      } catch (e) {
        message.error('Invalid JSON format for policy rules')
        return
      }

      const updatedPolicy: PolicyData = {
        ...editingPolicy.data,
        rules,
      }

      const jsonPatch = JSON.stringify([
        {
          op: 'replace',
          path: '/snapshotData',
          value: formatPolicyToSnapshotData(updatedPolicy),
        },
      ])

      await batchCommit({
        slugs: [editingPolicy.entity.slug],
        branch: currentBranch,
        jsonPatch,
        message: `Update policy ${editingPolicy.data.policyName} rules`,
      }).unwrap()

      message.success('Policy rules updated successfully')
      setPolicyEditModalOpen(false)
      setEditingPolicy(null)
      setPolicyRulesJson('{}')
      refetchPolicies()
    } catch (err: any) {
      const errorMessage = err?.data?.message || err?.message || 'Failed to update policy'
      if (err?.status === 403 || err?.data?.status === 403) {
        message.error(`Permission Denied: ${errorMessage}`)
      } else {
        message.error(errorMessage)
      }
    }
  }

  const userColumns: ColumnsType<EntityInstance> = [
    {
      title: 'Username',
      dataIndex: 'slug',
      key: 'slug',
      width: 200,
      render: (slug: string) => (
        <Text style={{ fontWeight: 500, color: colorText }}>{slug}</Text>
      ),
    },
    {
      title: 'Email',
      key: 'email',
      width: 250,
    },
    {
      title: 'Display Name',
      key: 'displayName',
      width: 200,
    },
    {
      title: 'Groups',
      key: 'groups',
      width: 300,
    },
    {
      title: 'Status',
      key: 'status',
      width: 100,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      fixed: 'right' as const,
    },
  ]

  const groupColumns: ColumnsType<EntityInstance> = [
    {
      title: 'Group Name',
      key: 'groupName',
      width: 200,
    },
    {
      title: 'Description',
      key: 'description',
      width: 300,
    },
    {
      title: 'Roles',
      key: 'roles',
      width: 300,
    },
    {
      title: 'Status',
      key: 'status',
      width: 100,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      fixed: 'right' as const,
    },
  ]

  const policyColumns: ColumnsType<EntityInstance> = [
    {
      title: 'Policy Name',
      dataIndex: 'slug',
      key: 'policyName',
      width: 200,
      render: (text: string) => <Text style={{ fontWeight: 500, color: colorText }}>{text}</Text>,
    },
    {
      title: 'Description',
      key: 'description',
      width: 300,
    },
    {
      title: 'Status',
      key: 'status',
      width: 100,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      fixed: 'right' as const,
      render: (_: any, record: EntityInstance) => (
        <Button
          type="link"
          size="small"
          icon={<Edit size={14} />}
          onClick={() => handlePolicyEditClick(record)}
        >
          Edit Rules
        </Button>
      ),
    },
  ]

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: colorBgContainer }}>
      <div
        style={{
          padding: '16px',
          borderBottom: `1px solid ${colorBorder}`,
          background: colorBgContainer,
        }}
      >
        <Space>
          <Shield size={18} color={colorPrimary} />
          <Text strong style={{ fontSize: '16px', color: colorText }}>
            Identity Manager
          </Text>
        </Space>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as TabKey)}
        style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        items={[
          {
            key: 'users',
            label: (
              <Space>
                <User size={16} />
                <span>Users</span>
              </Space>
            ),
            children: (
              <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
                <Table
                  columns={userColumns}
                  dataSource={users}
                  loading={isLoadingUsers}
                  rowKey="id"
                  pagination={{ pageSize: 20, showSizeChanger: true }}
                  components={{
                    body: {
                      row: (props: any) => {
                        const entity = users.find((e) => e.id === props['data-row-key'])
                        if (!entity) return <tr {...props} />
                        return (
                          <UserRow
                            key={entity.id}
                            entity={entity}
                            currentBranch={currentBranch}
                            onEdit={handleUserEdit}
                          />
                        )
                      },
                    },
                  }}
                />
              </div>
            ),
          },
          {
            key: 'groups',
            label: (
              <Space>
                <Users size={16} />
                <span>Groups</span>
              </Space>
            ),
            children: (
              <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
                <Table
                  columns={groupColumns}
                  dataSource={groups}
                  loading={isLoadingGroups}
                  rowKey="id"
                  pagination={{ pageSize: 20, showSizeChanger: true }}
                  components={{
                    body: {
                      row: (props: any) => {
                        const entity = groups.find((e) => e.id === props['data-row-key'])
                        if (!entity) return <tr {...props} />
                        return (
                          <GroupRow
                            key={entity.id}
                            entity={entity}
                            currentBranch={currentBranch}
                            onEdit={handleGroupEdit}
                          />
                        )
                      },
                    },
                  }}
                />
              </div>
            ),
          },
          {
            key: 'policies',
            label: (
              <Space>
                <Shield size={16} />
                <span>Policies</span>
              </Space>
            ),
            children: (
              <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
                <Table
                  columns={policyColumns}
                  dataSource={policies}
                  loading={isLoadingPolicies}
                  rowKey="id"
                  pagination={{ pageSize: 20, showSizeChanger: true }}
                />
              </div>
            ),
          },
        ]}
      />

      {/* User Edit Modal */}
      <Modal
        title="Edit User Groups"
        open={userEditModalOpen}
        onCancel={() => {
          setUserEditModalOpen(false)
          setEditingUser(null)
        }}
        onOk={() => {
          if (editingUser) {
            const selectedGroups = editingUser.data.groups || []
            handleUserSave(selectedGroups)
          }
        }}
        width={600}
      >
        {editingUser && (
          <div>
            <div style={{ marginBottom: '16px' }}>
              <Text strong>User: {editingUser.data.slug}</Text>
            </div>
            <Select
              mode="multiple"
              style={{ width: '100%' }}
              placeholder="Select groups"
              value={editingUser.data.groups || []}
              onChange={(value) => {
                if (editingUser) {
                  setEditingUser({
                    ...editingUser,
                    data: { ...editingUser.data, groups: value },
                  })
                }
              }}
              options={allGroups.map((g) => ({
                label: g.slug,
                value: g.slug,
              }))}
            />
          </div>
        )}
      </Modal>

      {/* Group Edit Modal */}
      <Modal
        title="Edit Group Roles"
        open={groupEditModalOpen}
        onCancel={() => {
          setGroupEditModalOpen(false)
          setEditingGroup(null)
        }}
        onOk={() => {
          if (editingGroup) {
            const selectedRoles = editingGroup.data.roles || []
            handleGroupSave(selectedRoles)
          }
        }}
        width={600}
      >
        {editingGroup && (
          <div>
            <div style={{ marginBottom: '16px' }}>
              <Text strong>Group: {editingGroup.data.groupName}</Text>
            </div>
            <Select
              mode="multiple"
              style={{ width: '100%' }}
              placeholder="Select roles/policies"
              value={editingGroup.data.roles || []}
              onChange={(value) => {
                if (editingGroup) {
                  setEditingGroup({
                    ...editingGroup,
                    data: { ...editingGroup.data, roles: value },
                  })
                }
              }}
              options={allPolicies.map((p) => ({
                label: p.slug,
                value: p.slug,
              }))}
            />
          </div>
        )}
      </Modal>

      {/* Policy Edit Modal */}
      {editingPolicy && (
        <PolicyEditModal
          open={policyEditModalOpen}
          entity={editingPolicy.entity}
          currentBranch={currentBranch}
          onCancel={() => {
            setPolicyEditModalOpen(false)
            setEditingPolicy(null)
            setPolicyRulesJson('{}')
          }}
          onSave={handlePolicySave}
        />
      )}
    </div>
  )
}

