// src/routes.js
import React from 'react'

const Dashboard     = React.lazy(() => import('./views/dashboard/Dashboard'))
const Tickets       = React.lazy(() => import('./views/tickets/Tickets'))
const TicketDetail  = React.lazy(() => import('./views/tickets/TicketDetail'))
const TicketForm    = React.lazy(() => import('./views/tickets/TicketForm'))
const Assets        = React.lazy(() => import('./views/assets/Assets'))
const AssetDetail   = React.lazy(() => import('./views/assets/AssetDetail'))
const AssetForm     = React.lazy(() => import('./views/assets/AssetForm'))
const Knowledge     = React.lazy(() => import('./views/knowledge/Knowledge'))
const Article       = React.lazy(() => import('./views/knowledge/Article'))
const ArticleForm   = React.lazy(() => import('./views/knowledge/ArticleForm'))
const Notifications = React.lazy(() => import('./views/notifications/Notifications'))
const Users         = React.lazy(() => import('./views/users/Users'))
const UserForm      = React.lazy(() => import('./views/users/UserForm'))
const Profile       = React.lazy(() => import('./views/profile/Profile'))  // ← nouveau

const routes = [
  { path: '/dashboard',           element: Dashboard },
  { path: '/tickets',             element: Tickets },
  { path: '/tickets/new',         element: TicketForm },
  { path: '/tickets/:ticketId',   element: TicketDetail },
  { path: '/tickets/:ticketId/edit', element: TicketForm },
  { path: '/assets',              element: Assets },
  { path: '/assets/new',          element: AssetForm },
  { path: '/assets/:assetId',     element: AssetDetail },
  { path: '/assets/:assetId/edit', element: AssetForm },
  { path: '/knowledge',           element: Knowledge },
  { path: '/knowledge/new',       element: ArticleForm },
  { path: '/knowledge/:articleId', element: Article },
  { path: '/knowledge/:articleId/edit', element: ArticleForm },
  { path: '/notifications',       element: Notifications },
  { path: '/users',               element: Users },        
  { path: '/users/new',           element: UserForm },     
  { path: '/users/:userId/edit',  element: UserForm },    
  { path: '/profile',             element: Profile },      
]

export default routes