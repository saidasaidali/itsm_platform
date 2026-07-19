# Composants Dashboard ITSM

Collection de composants React réutilisables pour le dashboard ITSM, basés sur CoreUI et le design existant.

## Composants disponibles

### 1. DashboardKpiCard

Carte KPI standardisée pour afficher des indicateurs clés.

**Usage** :
```jsx
import { DashboardKpiCard } from '@/components/dashboard'

<DashboardKpiCard
  title="Tickets ouverts"
  value={42}
  subtitle="En attente de traitement"
  badgeText="À traiter"
  badgeColor="warning"
/>
```

**Props** :
- `title` (string) - Titre en uppercase
- `value` (string|number) - Valeur principale
- `subtitle` (string, optionnel) - Texte secondaire
- `badgeText` (string, optionnel) - Texte du badge
- `badgeColor` (string, défaut: 'secondary') - Couleur du badge
- `valueColor` (string, optionnel) - Classe CSS pour la couleur de la valeur
- `clickable` (boolean, défaut: false) - Si la carte est cliquable
- `onClick` (function, optionnel) - Handler de clic

### 2. DashboardSection

Section standardisée avec titre et grille responsive.

**Usage** :
```jsx
import { DashboardSection } from '@/components/dashboard'

<DashboardSection title="Supervision en direct">
  <CCol xs={12} md={6} xl={3}>
    {/* Contenu */}
  </CCol>
</DashboardSection>
```

**Props** :
- `title` (string, optionnel) - Titre de la section
- `icon` (ReactNode, optionnel) - Icône à afficher
- `className` (string, défaut: '') - Classes CSS additionnelles
- `children` (ReactNode) - Contenu de la section

### 3. DashboardChartCard

Carte avec graphique Chart.js standardisée.

**Usage** :
```jsx
import { DashboardChartCard } from '@/components/dashboard'

<DashboardChartCard
  title="Évolution des tickets"
  type="line"
  data={{
    labels: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'],
    datasets: [
      {
        label: 'Tickets ouverts',
        data: [12, 18, 14, 20, 16, 22, 19],
        borderColor: '#5e4ef1',
        backgroundColor: 'rgba(94,78,241,0.15)',
        fill: true,
      },
    ],
  }}
  height="260px"
/>
```

**Props** :
- `title` (string) - Titre de la carte
- `type` (string) - Type de graphique (line, bar, doughnut, etc.)
- `data` (object) - Données du graphique (format Chart.js)
- `options` (object, optionnel) - Options du graphique
- `height` (string|number, défaut: '260px') - Hauteur du graphique

### 4. DashboardWidgetHeader

En-tête de widget standardisé.

**Usage** :
```jsx
import { DashboardWidgetHeader } from '@/components/dashboard'

<DashboardWidgetHeader title="Notifications récentes">
  <CBadge color="danger">3 nouvelles</CBadge>
</DashboardWidgetHeader>
```

**Props** :
- `title` (string) - Titre du widget
- `children` (ReactNode, optionnel) - Contenu additionnel

### 5. ListItem

Élément de liste standardisé avec badge.

**Usage** :
```jsx
import { ListItem } from '@/components/dashboard'

<ListItem
  title="Ticket #123 - Problème imprimante"
  subtitle="Poste non détecté"
  badgeText="Nouveau"
  badgeColor="warning"
  clickable
  onClick={() => navigate('/tickets/123')}
/>
```

**Props** :
- `title` (ReactNode) - Titre principal
- `subtitle` (ReactNode, optionnel) - Sous-titre
- `badgeText` (string, optionnel) - Texte du badge
- `badgeColor` (string, défaut: 'secondary') - Couleur du badge
- `clickable` (boolean, défaut: false) - Si l'élément est cliquable
- `onClick` (function, optionnel) - Handler de clic
- `children` (ReactNode, optionnel) - Contenu additionnel

## Architecture

```
frontend/src/components/dashboard/
├── index.js                      # Point d'export centralisé
├── DashboardKpiCard.jsx          # Carte KPI
├── DashboardSection.jsx          # Section avec titre
├── DashboardChartCard.jsx        # Carte avec graphique
├── DashboardWidgetHeader.jsx     # En-tête de widget
├── ListItem.jsx                  # Élément de liste
├── KPICard.jsx                   # Ancien composant (à migrer)
├── ChartCard.jsx                 # Ancien composant (à migrer)
└── README.md                     # Cette documentation
```

## Principes de conception

1. **Cohérence** : Tous les composants utilisent les mêmes patterns CoreUI
2. **Réutilisabilité** : Props génériques et flexibles
3. **Maintenabilité** : Code documenté et typé
4. **Performance** : Aucun impact sur les performances (même rendu)
5. **Compatibilité** : Design identique au dashboard existant

## Migration progressive

Les anciens composants `KPICard` et `ChartCard` sont conservés pour la compatibilité.
Les nouveaux composants `DashboardKpiCard` et `DashboardChartCard` doivent être utilisés pour les nouveaux développements.

## Exemple complet

```jsx
import { DashboardSection, DashboardKpiCard, DashboardChartCard, ListItem } from '@/components/dashboard'

function MonDashboard() {
  return (
    <>
      <DashboardSection title="KPIs principaux">
        <CCol xs={12} md={6} xl={3}>
          <DashboardKpiCard
            title="Tickets ouverts"
            value={42}
            badgeText="À traiter"
            badgeColor="warning"
          />
        </CCol>
      </DashboardSection>

      <DashboardSection title="Évolution">
        <CCol xs={12}>
          <DashboardChartCard
            title="Tickets par jour"
            type="line"
            data={chartData}
          />
        </CCol>
      </DashboardSection>

      <DashboardSection title="Derniers tickets">
        <CCol xs={12}>
          {tickets.map(ticket => (
            <ListItem
              key={ticket.id}
              title={`#${ticket.id} - ${ticket.title}`}
              badgeText={ticket.status}
              clickable
              onClick={() => navigate(`/tickets/${ticket.id}`)}
            />
          ))}
        </CCol>
      </DashboardSection>
    </>
  )
}
```

## Notes

- Tous les composants utilisent CoreUI 5.10.0
- Le design est identique au dashboard existant
- Aucune modification du backend n'est nécessaire
- Compatible avec le thème light/dark
- Supporte l'internationalisation (i18n)