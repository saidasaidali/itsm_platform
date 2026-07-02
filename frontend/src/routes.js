import React from 'react'

const Dashboard    = React.lazy(() => import('./views/dashboard/Dashboard'))
const Tickets      = React.lazy(() => import('./views/tickets/Tickets'))
const TicketDetail = React.lazy(() => import('./views/tickets/TicketDetail'))
const TicketForm   = React.lazy(() => import('./views/tickets/TicketForm'))
const Assets        = React.lazy(() => import('./views/assets/Assets'))
const ImportAssets  = React.lazy(() => import('./views/assets/ImportAssets'))
const AssetDetail   = React.lazy(() => import('./views/assets/AssetDetail'))
const AssetForm     = React.lazy(() => import('./views/assets/AssetForm'))
const ScanResult    = React.lazy(() => import('./views/assets/ScanResult'))
const PrintQRCodes  = React.lazy(() => import('./views/assets/PrintQRCodes'))
const Knowledge      = React.lazy(() => import('./views/knowledge/Knowledge'))
const Article        = React.lazy(() => import('./views/knowledge/Article'))
const ArticleForm    = React.lazy(() => import('./views/knowledge/ArticleForm'))
const ImportArticles = React.lazy(() => import('./views/knowledge/ImportArticles'))
const Notifications  = React.lazy(() => import('./views/notifications/Notifications'))
const Users        = React.lazy(() => import('./views/users/Users'))
const UserForm     = React.lazy(() => import('./views/users/UserForm'))
const ImportUsers  = React.lazy(() => import('./views/users/ImportUsers'))
const Anomalies    = React.lazy(() => import('./views/anomalies/Anomalies'))
const Parametres   = React.lazy(() => import('./views/settings/Parametres'))
const Reports      = React.lazy(() => import('./views/reports/Reports'))

const routes = [
  { path: '/dashboard', element: Dashboard },

  { path: '/tickets',                   element: Tickets },
  { path: '/tickets/new',               element: TicketForm },
  { path: '/tickets/:ticketId',         element: TicketDetail },
  { path: '/tickets/:ticketId/edit',    element: TicketForm },

  // Routes statiques assets AVANT les routes paramétriques
  { path: '/assets',                    element: Assets },
  { path: '/assets/new',                element: AssetForm },
  { path: '/assets/import',             element: ImportAssets },
  { path: '/assets/scan/:token',        element: ScanResult },
  { path: '/assets/print-qr',          element: PrintQRCodes },
  // Routes paramétriques assets APRÈS
  { path: '/assets/:assetId',           element: AssetDetail },
  { path: '/assets/:assetId/edit',      element: AssetForm },

  { path: '/knowledge',                 element: Knowledge },
  { path: '/knowledge/new',             element: ArticleForm },
  { path: '/knowledge/import',          element: ImportArticles },
  { path: '/knowledge/:articleId',      element: Article },
  { path: '/knowledge/:articleId/edit', element: ArticleForm },

  { path: '/notifications', element: Notifications },

  // Routes statiques users AVANT les routes paramétriques
  { path: '/users',                     element: Users },
  { path: '/users/import',              element: ImportUsers },
  { path: '/users/new',                 element: UserForm },
  { path: '/users/:userId',             element: UserForm },
  { path: '/users/:userId/edit',        element: UserForm },

  { path: '/anomalies',  element: Anomalies },
  { path: '/parametres', element: Parametres },
  { path: '/reports',    element: Reports },
]

export default routes