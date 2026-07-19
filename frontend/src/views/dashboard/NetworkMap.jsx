import React, { useEffect, useState, useCallback, useMemo } from 'react'
import ReactFlow, { Background, Controls, MiniMap } from 'reactflow'
import 'reactflow/dist/style.css'
import { useNavigate } from 'react-router-dom'
import { CCard, CCardBody, CCardHeader, CSpinner, CBadge } from '@coreui/react'
import { useTranslation } from 'react-i18next'

import { getNetworkMap } from '../../services/dashboardService'

const TYPES = ['Ordinateur', 'Imprimante', 'Switch', 'Serveur']
const TYPE_COLOR = {
  Ordinateur: '#3b82f6',
  Imprimante: '#f59e0b',
  Switch: '#8b5cf6',
  Serveur: '#ef4444',
}

const NetworkMap = () => {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getNetworkMap()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const nodes = useMemo(() => {
    if (!data?.nodes) return []

    const byType = { Serveur: [], Switch: [], Ordinateur: [], Imprimante: [] }
    data.nodes.forEach((node) => {
      if (byType[node.type]) byType[node.type].push(node)
    })

    const columns = { Serveur: 0, Switch: 250, Ordinateur: 500, Imprimante: 750 }
    const result = []

    Object.entries(byType).forEach(([type, items]) => {
      items.forEach((item, index) => {
        result.push({
          id: String(item.id),
          position: { x: columns[type], y: index * 90 + 20 },
          data: { ...item },
          style: {
            border: `2px solid ${item.is_online ? '#22c55e' : '#9ca3af'}`,
            borderRadius: '6px',
            padding: '8px 12px',
            background: item.is_online ? 'rgba(34,197,94,0.06)' : '#fff',
            width: 200,
            cursor: 'pointer',
          },
          type: 'default',
        })
      })
    })
    return result
  }, [data])

  const edges = useMemo(() => {
    if (!data?.edges) return []
    return data.edges.map((edge, index) => ({
      id: `e${index}`,
      source: String(edge.source_asset_id),
      target: String(edge.target_asset_id),
      animated: edge.relation_type === 'uses_printer',
      style: { stroke: '#94a3b8' },
      label: edge.relation_type === 'uses_printer' ? t('dashboard.network.prints_on') : '',
      labelStyle: { fontSize: 10, fill: '#64748b' },
    }))
  }, [data, t])

  const nodesWithLabel = useMemo(
    () =>
      nodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          label: (
            <div onClick={() => navigate(`/assets/${node.data.id}`)}>
              <div style={{ fontSize: '13px', fontWeight: 600 }}>{node.data.asset_tag}</div>
              <div style={{ fontSize: '11px', color: '#666' }}>
                {node.data.brand} {node.data.model}
              </div>
              {node.data.assigned_to_name && (
                <div style={{ fontSize: '10px', color: '#888' }}>{node.data.assigned_to_name}</div>
              )}
            </div>
          ),
        },
      })),
    [nodes, navigate],
  )

  const onNodeClick = useCallback(
    (event, node) => {
      navigate(`/assets/${node.id}`)
    },
    [navigate],
  )

  return (
    <CCard className="mb-4">
      <CCardHeader className="d-flex justify-content-between align-items-center">
        <strong>{t('dashboard.network.title')}</strong>
        <div className="d-flex gap-2">
          {TYPES.map((type) => (
            <CBadge key={type} style={{ background: TYPE_COLOR[type] }}>
              {t(`dashboard.network.types.${type}`)}
            </CBadge>
          ))}
        </div>
      </CCardHeader>
      <CCardBody style={{ height: '500px', padding: 0 }}>
        {loading ? (
          <div className="text-center p-5">
            <CSpinner />
          </div>
        ) : nodesWithLabel.length === 0 ? (
          <p className="text-center text-muted p-5">{t('dashboard.network.empty')}</p>
        ) : (
          <ReactFlow
            nodes={nodesWithLabel}
            edges={edges}
            onNodeClick={onNodeClick}
            fitView
            nodesDraggable
            nodesConnectable={false}
          >
            <Background color="#e5e7eb" gap={20} />
            <Controls />
            <MiniMap pannable zoomable />
          </ReactFlow>
        )}
      </CCardBody>
    </CCard>
  )
}

export default NetworkMap
